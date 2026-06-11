module chivo_payments::payments;

use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, UID};
use sui::sui::SUI;
use sui::transfer;
use sui::tx_context::{Self, TxContext};

const STATUS_CREATED: u8 = 0;
const STATUS_DEPOSITED: u8 = 1;
const STATUS_RELEASED: u8 = 2;
const STATUS_REFUNDED: u8 = 3;
const STATUS_FROZEN: u8 = 4;
const STATUS_CANCELLED: u8 = 5;

const E_UNAUTHORIZED: u64 = 1;
const E_PAUSED: u64 = 2;
const E_RAIL_DISABLED: u64 = 3;
const E_INVALID_FEE: u64 = 4;
const E_INVALID_AMOUNT: u64 = 5;
const E_INVALID_STATUS: u64 = 6;
const E_INTENT_EXPIRED: u64 = 7;
const E_INTENT_NOT_READY: u64 = 8;
const E_INVALID_ACCOUNT: u64 = 9;
const E_ESCROW_NOT_EMPTY: u64 = 10;

public struct Config has key {
    id: UID,
    owner: address,
    payout_operator: address,
    fee_collector: address,
    paused: bool,
    native_payments_enabled: bool,
    native_fee_bps: u64,
    max_fee_bps: u64,
    auto_release_delay_ms: u64,
}

public struct PaymentIntent has key {
    id: UID,
    intent_id: vector<u8>,
    expected_payer: address,
    payer: address,
    recipient: address,
    amount: u64,
    escrow: Balance<SUI>,
    fee_bps: u64,
    expires_at_ms: u64,
    release_after_ms: u64,
    status: u8,
}

public struct ConfigUpdated has copy, drop {
    fee_collector: address,
    payout_operator: address,
    native_payments_enabled: bool,
    native_fee_bps: u64,
    max_fee_bps: u64,
    auto_release_delay_ms: u64,
}

public struct PauseUpdated has copy, drop {
    paused: bool,
}

public struct IntentCreated has copy, drop {
    intent_id: vector<u8>,
    expected_payer: address,
    recipient: address,
    amount: u64,
    fee_bps: u64,
    expires_at_ms: u64,
}

public struct SuiDeposited has copy, drop {
    intent_id: vector<u8>,
    payer: address,
    recipient: address,
    gross_amount: u64,
    fee_bps: u64,
    release_after_ms: u64,
}

public struct SuiReleased has copy, drop {
    intent_id: vector<u8>,
    payer: address,
    recipient: address,
    gross_amount: u64,
    platform_fee: u64,
    net_amount: u64,
    fee_bps: u64,
}

public struct SuiRefunded has copy, drop {
    intent_id: vector<u8>,
    payer: address,
    gross_amount: u64,
    reason_code: vector<u8>,
}

public struct SuiFrozen has copy, drop {
    intent_id: vector<u8>,
    frozen: bool,
    reason_code: vector<u8>,
}

public struct IntentCancelled has copy, drop {
    intent_id: vector<u8>,
    reason_code: vector<u8>,
}

public entry fun initialize_config(
    fee_collector: address,
    payout_operator: address,
    max_fee_bps: u64,
    native_fee_bps: u64,
    auto_release_delay_ms: u64,
    ctx: &mut TxContext,
) {
    assert!(fee_collector != @0x0, E_INVALID_ACCOUNT);
    assert!(payout_operator != @0x0, E_INVALID_ACCOUNT);
    assert!(max_fee_bps <= 2500, E_INVALID_FEE);
    assert!(native_fee_bps <= max_fee_bps, E_INVALID_FEE);

    let config = Config {
        id: object::new(ctx),
        owner: tx_context::sender(ctx),
        payout_operator,
        fee_collector,
        paused: false,
        native_payments_enabled: true,
        native_fee_bps,
        max_fee_bps,
        auto_release_delay_ms,
    };

    emit_config(&config);
    transfer::share_object(config);
}

public entry fun set_pause(config: &mut Config, paused: bool, ctx: &TxContext) {
    assert_owner(config, ctx);
    config.paused = paused;
    event::emit(PauseUpdated { paused });
}

public entry fun set_fee_collector(config: &mut Config, fee_collector: address, ctx: &TxContext) {
    assert_owner(config, ctx);
    assert!(fee_collector != @0x0, E_INVALID_ACCOUNT);
    config.fee_collector = fee_collector;
    emit_config(config);
}

public entry fun set_payout_operator(config: &mut Config, payout_operator: address, ctx: &TxContext) {
    assert_owner(config, ctx);
    assert!(payout_operator != @0x0, E_INVALID_ACCOUNT);
    config.payout_operator = payout_operator;
    emit_config(config);
}

public entry fun set_native_rail_config(
    config: &mut Config,
    enabled: bool,
    fee_bps: u64,
    auto_release_delay_ms: u64,
    ctx: &TxContext,
) {
    assert_owner(config, ctx);
    assert!(fee_bps <= config.max_fee_bps, E_INVALID_FEE);
    config.native_payments_enabled = enabled;
    config.native_fee_bps = fee_bps;
    config.auto_release_delay_ms = auto_release_delay_ms;
    emit_config(config);
}

public entry fun create_sui_intent(
    config: &Config,
    intent_id: vector<u8>,
    expected_payer: address,
    recipient: address,
    amount: u64,
    fee_bps: u64,
    expires_at_ms: u64,
    ctx: &mut TxContext,
) {
    assert_owner(config, ctx);
    assert!(!config.paused, E_PAUSED);
    assert!(config.native_payments_enabled, E_RAIL_DISABLED);
    assert!(recipient != @0x0, E_INVALID_ACCOUNT);
    assert!(amount > 0, E_INVALID_AMOUNT);
    assert!(fee_bps == config.native_fee_bps, E_INVALID_FEE);

    let intent = PaymentIntent {
        id: object::new(ctx),
        intent_id,
        expected_payer,
        payer: @0x0,
        recipient,
        amount,
        escrow: balance::zero<SUI>(),
        fee_bps,
        expires_at_ms,
        release_after_ms: 0,
        status: STATUS_CREATED,
    };

    event::emit(IntentCreated {
        intent_id: intent.intent_id,
        expected_payer,
        recipient,
        amount,
        fee_bps,
        expires_at_ms,
    });

    transfer::share_object(intent);
}

public entry fun deposit_sui(
    config: &Config,
    intent: &mut PaymentIntent,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(!config.paused, E_PAUSED);
    assert!(config.native_payments_enabled, E_RAIL_DISABLED);
    assert!(intent.status == STATUS_CREATED, E_INVALID_STATUS);
    assert!(clock::timestamp_ms(clock) <= intent.expires_at_ms, E_INTENT_EXPIRED);
    assert!(coin::value(&payment) == intent.amount, E_INVALID_AMOUNT);
    assert!(intent.fee_bps == config.native_fee_bps, E_INVALID_FEE);

    let payer = tx_context::sender(ctx);
    if (intent.expected_payer != @0x0) {
        assert!(intent.expected_payer == payer, E_INVALID_ACCOUNT);
    };

    balance::join(&mut intent.escrow, coin::into_balance(payment));
    intent.payer = payer;
    intent.release_after_ms = clock::timestamp_ms(clock) + config.auto_release_delay_ms;
    intent.status = STATUS_DEPOSITED;

    event::emit(SuiDeposited {
        intent_id: intent.intent_id,
        payer,
        recipient: intent.recipient,
        gross_amount: intent.amount,
        fee_bps: intent.fee_bps,
        release_after_ms: intent.release_after_ms,
    });
}

public entry fun release_sui(
    config: &Config,
    intent: &mut PaymentIntent,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_payout_operator(config, ctx);
    assert!(!config.paused, E_PAUSED);
    assert!(intent.status == STATUS_DEPOSITED, E_INVALID_STATUS);
    assert!(clock::timestamp_ms(clock) >= intent.release_after_ms, E_INTENT_NOT_READY);

    let gross_amount = intent.amount;
    let fee = calculate_fee(gross_amount, intent.fee_bps);
    let net = gross_amount - fee;
    let payer = intent.payer;
    let recipient = intent.recipient;
    let fee_bps = intent.fee_bps;
    let intent_id = intent.intent_id;

    intent.status = STATUS_RELEASED;

    if (fee > 0) {
        let fee_coin = coin::from_balance(balance::split(&mut intent.escrow, fee), ctx);
        transfer::public_transfer(fee_coin, config.fee_collector);
    };

    let net_coin = coin::from_balance(balance::split(&mut intent.escrow, net), ctx);
    transfer::public_transfer(net_coin, recipient);

    event::emit(SuiReleased {
        intent_id,
        payer,
        recipient,
        gross_amount,
        platform_fee: fee,
        net_amount: net,
        fee_bps,
    });
}

public entry fun refund_sui(
    config: &Config,
    intent: &mut PaymentIntent,
    reason_code: vector<u8>,
    ctx: &mut TxContext,
) {
    assert_payout_operator(config, ctx);
    assert!(
        intent.status == STATUS_DEPOSITED || intent.status == STATUS_FROZEN,
        E_INVALID_STATUS,
    );

    let refund_amount = intent.amount;
    let payer = intent.payer;
    let intent_id = intent.intent_id;
    intent.status = STATUS_REFUNDED;

    let refund_coin = coin::from_balance(balance::split(&mut intent.escrow, refund_amount), ctx);
    transfer::public_transfer(refund_coin, payer);

    event::emit(SuiRefunded {
        intent_id,
        payer,
        gross_amount: refund_amount,
        reason_code,
    });
}

public entry fun freeze_sui(
    config: &Config,
    intent: &mut PaymentIntent,
    reason_code: vector<u8>,
    ctx: &TxContext,
) {
    assert_owner(config, ctx);
    assert!(intent.status == STATUS_DEPOSITED, E_INVALID_STATUS);
    intent.status = STATUS_FROZEN;
    event::emit(SuiFrozen { intent_id: intent.intent_id, frozen: true, reason_code });
}

public entry fun unfreeze_sui(
    config: &Config,
    intent: &mut PaymentIntent,
    reason_code: vector<u8>,
    ctx: &TxContext,
) {
    assert_owner(config, ctx);
    assert!(intent.status == STATUS_FROZEN, E_INVALID_STATUS);
    intent.status = STATUS_DEPOSITED;
    event::emit(SuiFrozen { intent_id: intent.intent_id, frozen: false, reason_code });
}

public entry fun cancel_sui_intent(
    config: &Config,
    intent: &mut PaymentIntent,
    reason_code: vector<u8>,
    ctx: &TxContext,
) {
    assert_owner(config, ctx);
    assert!(intent.status == STATUS_CREATED, E_INVALID_STATUS);
    intent.status = STATUS_CANCELLED;
    event::emit(IntentCancelled { intent_id: intent.intent_id, reason_code });
}

public entry fun delete_final_intent(intent: PaymentIntent) {
    assert!(
        intent.status == STATUS_RELEASED
            || intent.status == STATUS_REFUNDED
            || intent.status == STATUS_CANCELLED,
        E_INVALID_STATUS,
    );
    assert!(balance::value(&intent.escrow) == 0, E_ESCROW_NOT_EMPTY);

    let PaymentIntent {
        id,
        intent_id: _,
        expected_payer: _,
        payer: _,
        recipient: _,
        amount: _,
        escrow,
        fee_bps: _,
        expires_at_ms: _,
        release_after_ms: _,
        status: _,
    } = intent;

    balance::destroy_zero(escrow);
    object::delete(id);
}

fun assert_owner(config: &Config, ctx: &TxContext) {
    assert!(tx_context::sender(ctx) == config.owner, E_UNAUTHORIZED);
}

fun assert_payout_operator(config: &Config, ctx: &TxContext) {
    let sender = tx_context::sender(ctx);
    assert!(sender == config.owner || sender == config.payout_operator, E_UNAUTHORIZED);
}

fun calculate_fee(amount: u64, fee_bps: u64): u64 {
    amount * fee_bps / 10000
}

fun emit_config(config: &Config) {
    event::emit(ConfigUpdated {
        fee_collector: config.fee_collector,
        payout_operator: config.payout_operator,
        native_payments_enabled: config.native_payments_enabled,
        native_fee_bps: config.native_fee_bps,
        max_fee_bps: config.max_fee_bps,
        auto_release_delay_ms: config.auto_release_delay_ms,
    });
}
