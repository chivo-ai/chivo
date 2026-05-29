// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ChivoPaymentRouter is Ownable, EIP712, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    enum PaymentStatus {
        None,
        Deposited,
        Released,
        Refunded,
        Frozen
    }

    struct RailConfig {
        bool enabled;
        bool recipientAllowlistRequired;
        uint16 feeBps;
        uint128 minAmount;
        uint128 maxAmount;
        uint64 minReleaseDelay;
    }

    struct EscrowPayment {
        address payer;
        address recipient;
        address token;
        uint256 grossAmount;
        uint256 platformFee;
        uint256 netAmount;
        uint16 feeBps;
        uint64 expiresAt;
        uint64 releaseAfter;
        PaymentStatus status;
    }

    bytes32 public constant PAYMENT_AUTHORIZATION_TYPEHASH = keccak256(
        "PaymentAuthorization(bytes32 intentId,address payer,address recipient,address token,uint256 amount,uint16 feeBps,uint64 expiresAt,uint64 releaseAfter)"
    );

    uint16 public constant ABSOLUTE_MAX_FEE_BPS = 2_500;

    error InvalidAddress();
    error InvalidAmount();
    error InvalidFee();
    error InvalidReleaseDelay();
    error RailDisabled();
    error IntentExpired();
    error IntentUnavailable();
    error IntentNotReady();
    error InvalidNativeValue();
    error InvalidAuthorization();
    error UnauthorizedPayoutOperator();
    error UnauthorizedRiskOperator();
    error AccountBlocked();
    error RecipientNotApproved();
    error InvalidPaymentStatus();
    error NativeTransferFailed();
    error InsufficientRecoverableFunds();
    error FeeOnTransferTokenUnsupported();
    error BatchTooLarge();

    event PaymentDeposited(
        bytes32 indexed intentId,
        address indexed payer,
        address indexed recipient,
        address token,
        uint256 grossAmount,
        uint256 platformFee,
        uint256 netAmount,
        uint16 feeBps,
        uint64 expiresAt,
        uint64 releaseAfter
    );

    event PaymentReleased(
        bytes32 indexed intentId,
        address indexed payer,
        address indexed recipient,
        address token,
        uint256 platformFee,
        uint256 netAmount,
        address feeCollector
    );

    event PaymentRefunded(
        bytes32 indexed intentId,
        address indexed payer,
        address token,
        uint256 grossAmount,
        bytes32 reasonCode
    );

    event PaymentFrozen(bytes32 indexed intentId, bool frozen, bytes32 reasonCode);
    event IntentCancelled(bytes32 indexed intentId, bytes32 reasonCode);
    event RailConfigUpdated(
        address indexed token,
        bool enabled,
        bool recipientAllowlistRequired,
        uint16 feeBps,
        uint128 minAmount,
        uint128 maxAmount,
        uint64 minReleaseDelay
    );
    event AuthorizerUpdated(address indexed authorizer);
    event FeeCollectorUpdated(address indexed feeCollector);
    event MaxFeeBpsUpdated(uint16 maxFeeBps);
    event PayoutOperatorUpdated(address indexed operator, bool enabled);
    event RiskOperatorUpdated(address indexed operator, bool enabled);
    event AccountBlockedUpdated(address indexed account, bool blocked);
    event RecipientApprovalUpdated(address indexed recipient, bool approved);
    event StuckFundsWithdrawn(address indexed token, address indexed recipient, uint256 amount);

    address public authorizer;
    address payable public feeCollector;
    uint16 public maxFeeBps = ABSOLUTE_MAX_FEE_BPS;
    uint16 public maxBatchSize = 80;

    mapping(address => RailConfig) public railConfigs;
    mapping(bytes32 => EscrowPayment) public payments;
    mapping(bytes32 => bool) public cancelledIntents;
    mapping(address => bool) public payoutOperators;
    mapping(address => bool) public riskOperators;
    mapping(address => bool) public blockedAccounts;
    mapping(address => bool) public approvedRecipients;
    mapping(address => uint256) public escrowedTokenBalance;

    uint256 public escrowedNativeBalance;

    constructor(address initialOwner, address initialAuthorizer, address payable initialFeeCollector)
        Ownable(initialOwner)
        EIP712("ChivoPaymentRouter", "1")
    {
        if (initialOwner == address(0) || initialAuthorizer == address(0) || initialFeeCollector == address(0)) {
            revert InvalidAddress();
        }

        authorizer = initialAuthorizer;
        feeCollector = initialFeeCollector;
        payoutOperators[initialOwner] = true;
        riskOperators[initialOwner] = true;

        railConfigs[address(0)] = RailConfig({
            enabled: true,
            recipientAllowlistRequired: false,
            feeBps: 50,
            minAmount: 1,
            maxAmount: 0,
            minReleaseDelay: 0
        });

        emit PayoutOperatorUpdated(initialOwner, true);
        emit RiskOperatorUpdated(initialOwner, true);
        emit RailConfigUpdated(address(0), true, false, 50, 1, 0, 0);
    }

    receive() external payable {}

    function depositNative(
        bytes32 intentId,
        address recipient,
        uint256 amount,
        uint16 feeBps,
        uint64 expiresAt,
        uint64 releaseAfter,
        bytes calldata authorization
    ) external payable nonReentrant whenNotPaused {
        if (msg.value != amount) {
            revert InvalidNativeValue();
        }

        _validateDeposit(intentId, msg.sender, recipient, address(0), amount, feeBps, expiresAt, releaseAfter, authorization);
        _recordDeposit(intentId, msg.sender, recipient, address(0), amount, feeBps, expiresAt, releaseAfter);
        escrowedNativeBalance += amount;
    }

    function depositToken(
        bytes32 intentId,
        address recipient,
        address token,
        uint256 amount,
        uint16 feeBps,
        uint64 expiresAt,
        uint64 releaseAfter,
        bytes calldata authorization
    ) external nonReentrant whenNotPaused {
        _validateDeposit(intentId, msg.sender, recipient, token, amount, feeBps, expiresAt, releaseAfter, authorization);

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received != amount) {
            revert FeeOnTransferTokenUnsupported();
        }

        _recordDeposit(intentId, msg.sender, recipient, token, amount, feeBps, expiresAt, releaseAfter);
        escrowedTokenBalance[token] += amount;
    }

    function releasePayment(bytes32 intentId) external nonReentrant whenNotPaused onlyPayoutOperator {
        _releasePayment(intentId);
    }

    function releasePayments(bytes32[] calldata intentIds) external nonReentrant whenNotPaused onlyPayoutOperator {
        if (intentIds.length > maxBatchSize) {
            revert BatchTooLarge();
        }

        for (uint256 i = 0; i < intentIds.length; i++) {
            _releasePayment(intentIds[i]);
        }
    }

    function refundPayment(bytes32 intentId, bytes32 reasonCode) external nonReentrant onlyRiskOperator {
        _refundPayment(intentId, reasonCode);
    }

    function refundPayments(bytes32[] calldata intentIds, bytes32 reasonCode) external nonReentrant onlyRiskOperator {
        if (intentIds.length > maxBatchSize) {
            revert BatchTooLarge();
        }

        for (uint256 i = 0; i < intentIds.length; i++) {
            _refundPayment(intentIds[i], reasonCode);
        }
    }

    function freezePayment(bytes32 intentId, bytes32 reasonCode) external onlyRiskOperator {
        EscrowPayment storage payment = payments[intentId];
        if (payment.status != PaymentStatus.Deposited) {
            revert InvalidPaymentStatus();
        }

        payment.status = PaymentStatus.Frozen;
        emit PaymentFrozen(intentId, true, reasonCode);
    }

    function unfreezePayment(bytes32 intentId, bytes32 reasonCode) external onlyRiskOperator {
        EscrowPayment storage payment = payments[intentId];
        if (payment.status != PaymentStatus.Frozen) {
            revert InvalidPaymentStatus();
        }

        payment.status = PaymentStatus.Deposited;
        emit PaymentFrozen(intentId, false, reasonCode);
    }

    function cancelIntent(bytes32 intentId, bytes32 reasonCode) external onlyRiskOperator {
        if (intentId == bytes32(0)) {
            revert InvalidAddress();
        }

        if (payments[intentId].status != PaymentStatus.None) {
            revert InvalidPaymentStatus();
        }

        cancelledIntents[intentId] = true;
        emit IntentCancelled(intentId, reasonCode);
    }

    function setRailConfig(
        address token,
        bool enabled,
        bool recipientAllowlistRequired,
        uint16 feeBps,
        uint128 minAmount,
        uint128 maxAmount,
        uint64 minReleaseDelay
    ) external onlyOwner {
        if (feeBps > maxFeeBps || (maxAmount != 0 && minAmount > maxAmount)) {
            revert InvalidFee();
        }

        railConfigs[token] = RailConfig({
            enabled: enabled,
            recipientAllowlistRequired: recipientAllowlistRequired,
            feeBps: feeBps,
            minAmount: minAmount,
            maxAmount: maxAmount,
            minReleaseDelay: minReleaseDelay
        });

        emit RailConfigUpdated(token, enabled, recipientAllowlistRequired, feeBps, minAmount, maxAmount, minReleaseDelay);
    }

    function setAuthorizer(address nextAuthorizer) external onlyOwner {
        if (nextAuthorizer == address(0)) {
            revert InvalidAddress();
        }

        authorizer = nextAuthorizer;
        emit AuthorizerUpdated(nextAuthorizer);
    }

    function setFeeCollector(address payable nextFeeCollector) external onlyOwner {
        if (nextFeeCollector == address(0)) {
            revert InvalidAddress();
        }

        feeCollector = nextFeeCollector;
        emit FeeCollectorUpdated(nextFeeCollector);
    }

    function setMaxFeeBps(uint16 nextMaxFeeBps) external onlyOwner {
        if (nextMaxFeeBps > ABSOLUTE_MAX_FEE_BPS) {
            revert InvalidFee();
        }

        maxFeeBps = nextMaxFeeBps;
        emit MaxFeeBpsUpdated(nextMaxFeeBps);
    }

    function setMaxBatchSize(uint16 nextMaxBatchSize) external onlyOwner {
        if (nextMaxBatchSize == 0 || nextMaxBatchSize > 500) {
            revert InvalidAmount();
        }

        maxBatchSize = nextMaxBatchSize;
    }

    function setPayoutOperator(address operator, bool enabled) external onlyOwner {
        if (operator == address(0)) {
            revert InvalidAddress();
        }

        payoutOperators[operator] = enabled;
        emit PayoutOperatorUpdated(operator, enabled);
    }

    function setRiskOperator(address operator, bool enabled) external onlyOwner {
        if (operator == address(0)) {
            revert InvalidAddress();
        }

        riskOperators[operator] = enabled;
        emit RiskOperatorUpdated(operator, enabled);
    }

    function setAccountBlocked(address account, bool blocked) external onlyRiskOperator {
        if (account == address(0)) {
            revert InvalidAddress();
        }

        blockedAccounts[account] = blocked;
        emit AccountBlockedUpdated(account, blocked);
    }

    function setRecipientApproved(address recipient, bool approved) external onlyRiskOperator {
        if (recipient == address(0)) {
            revert InvalidAddress();
        }

        approvedRecipients[recipient] = approved;
        emit RecipientApprovalUpdated(recipient, approved);
    }

    function withdrawStuckNative(address payable recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0)) {
            revert InvalidAddress();
        }

        uint256 recoverable = address(this).balance - escrowedNativeBalance;
        if (amount > recoverable) {
            revert InsufficientRecoverableFunds();
        }

        _sendNative(recipient, amount);
        emit StuckFundsWithdrawn(address(0), recipient, amount);
    }

    function withdrawStuckToken(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(0) || recipient == address(0)) {
            revert InvalidAddress();
        }

        uint256 recoverable = IERC20(token).balanceOf(address(this)) - escrowedTokenBalance[token];
        if (amount > recoverable) {
            revert InsufficientRecoverableFunds();
        }

        IERC20(token).safeTransfer(recipient, amount);
        emit StuckFundsWithdrawn(token, recipient, amount);
    }

    function pause() external onlyRiskOperator {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function authorizationDigest(
        bytes32 intentId,
        address payer,
        address recipient,
        address token,
        uint256 amount,
        uint16 feeBps,
        uint64 expiresAt,
        uint64 releaseAfter
    ) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    PAYMENT_AUTHORIZATION_TYPEHASH,
                    intentId,
                    payer,
                    recipient,
                    token,
                    amount,
                    feeBps,
                    expiresAt,
                    releaseAfter
                )
            )
        );
    }

    function _recordDeposit(
        bytes32 intentId,
        address payer,
        address recipient,
        address token,
        uint256 amount,
        uint16 feeBps,
        uint64 expiresAt,
        uint64 releaseAfter
    ) internal {
        (uint256 platformFee, uint256 netAmount) = _splitAmount(amount, feeBps);

        payments[intentId] = EscrowPayment({
            payer: payer,
            recipient: recipient,
            token: token,
            grossAmount: amount,
            platformFee: platformFee,
            netAmount: netAmount,
            feeBps: feeBps,
            expiresAt: expiresAt,
            releaseAfter: releaseAfter,
            status: PaymentStatus.Deposited
        });

        emit PaymentDeposited(
            intentId,
            payer,
            recipient,
            token,
            amount,
            platformFee,
            netAmount,
            feeBps,
            expiresAt,
            releaseAfter
        );
    }

    function _releasePayment(bytes32 intentId) internal {
        EscrowPayment storage payment = payments[intentId];
        if (payment.status != PaymentStatus.Deposited) {
            revert InvalidPaymentStatus();
        }

        if (payment.releaseAfter > block.timestamp) {
            revert IntentNotReady();
        }

        if (blockedAccounts[payment.recipient] || blockedAccounts[payment.payer] || blockedAccounts[payment.token]) {
            revert AccountBlocked();
        }

        payment.status = PaymentStatus.Released;
        _decreaseEscrow(payment.token, payment.grossAmount);

        if (payment.token == address(0)) {
            _sendNative(feeCollector, payment.platformFee);
            _sendNative(payable(payment.recipient), payment.netAmount);
        } else {
            IERC20 token = IERC20(payment.token);
            token.safeTransfer(feeCollector, payment.platformFee);
            token.safeTransfer(payment.recipient, payment.netAmount);
        }

        emit PaymentReleased(
            intentId,
            payment.payer,
            payment.recipient,
            payment.token,
            payment.platformFee,
            payment.netAmount,
            feeCollector
        );
    }

    function _refundPayment(bytes32 intentId, bytes32 reasonCode) internal {
        EscrowPayment storage payment = payments[intentId];
        if (payment.status != PaymentStatus.Deposited && payment.status != PaymentStatus.Frozen) {
            revert InvalidPaymentStatus();
        }

        payment.status = PaymentStatus.Refunded;
        _decreaseEscrow(payment.token, payment.grossAmount);

        if (payment.token == address(0)) {
            _sendNative(payable(payment.payer), payment.grossAmount);
        } else {
            IERC20(payment.token).safeTransfer(payment.payer, payment.grossAmount);
        }

        emit PaymentRefunded(intentId, payment.payer, payment.token, payment.grossAmount, reasonCode);
    }

    function _validateDeposit(
        bytes32 intentId,
        address payer,
        address recipient,
        address token,
        uint256 amount,
        uint16 feeBps,
        uint64 expiresAt,
        uint64 releaseAfter,
        bytes calldata authorization
    ) internal view {
        if (intentId == bytes32(0) || payer == address(0) || recipient == address(0)) {
            revert InvalidAddress();
        }

        if (token == address(0) && recipient == address(this)) {
            revert InvalidAddress();
        }

        if (blockedAccounts[payer] || blockedAccounts[recipient] || blockedAccounts[token]) {
            revert AccountBlocked();
        }

        RailConfig memory rail = railConfigs[token];
        if (!rail.enabled) {
            revert RailDisabled();
        }

        if (amount < rail.minAmount || (rail.maxAmount != 0 && amount > rail.maxAmount)) {
            revert InvalidAmount();
        }

        if (feeBps != rail.feeBps || feeBps > maxFeeBps) {
            revert InvalidFee();
        }

        if (rail.recipientAllowlistRequired && !approvedRecipients[recipient]) {
            revert RecipientNotApproved();
        }

        if (expiresAt < block.timestamp || releaseAfter > expiresAt) {
            revert IntentExpired();
        }

        if (releaseAfter < block.timestamp + rail.minReleaseDelay) {
            revert InvalidReleaseDelay();
        }

        if (payments[intentId].status != PaymentStatus.None || cancelledIntents[intentId]) {
            revert IntentUnavailable();
        }

        bytes32 digest = authorizationDigest(intentId, payer, recipient, token, amount, feeBps, expiresAt, releaseAfter);
        address recovered = digest.recover(authorization);
        if (recovered != authorizer) {
            revert InvalidAuthorization();
        }
    }

    function _splitAmount(uint256 amount, uint16 feeBps) internal pure returns (uint256 platformFee, uint256 netAmount) {
        platformFee = (amount * feeBps) / 10_000;
        netAmount = amount - platformFee;
    }

    function _decreaseEscrow(address token, uint256 amount) internal {
        if (token == address(0)) {
            escrowedNativeBalance -= amount;
        } else {
            escrowedTokenBalance[token] -= amount;
        }
    }

    function _sendNative(address payable recipient, uint256 amount) internal {
        if (amount == 0) {
            return;
        }

        (bool success,) = recipient.call{value: amount}("");
        if (!success) {
            revert NativeTransferFailed();
        }
    }

    modifier onlyPayoutOperator() {
        if (!payoutOperators[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedPayoutOperator();
        }
        _;
    }

    modifier onlyRiskOperator() {
        if (!riskOperators[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedRiskOperator();
        }
        _;
    }
}
