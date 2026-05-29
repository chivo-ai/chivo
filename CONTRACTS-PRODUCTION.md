# Chivo Contract Production Runbook

This runbook covers the contract-side controls needed before Chivo accepts real value on EVM or Solana.

## Authority Setup

Use separate keys/accounts:

- owner: company multisig
- authorizer: backend signing key for payment intents
- payout operator: automated release worker
- risk operator: company control key for pause, block, freeze, refund, cancel
- fee collector: company treasury wallet

Do not use one hot wallet for all roles.

## EVM Deployment

Deploy one `ChivoPaymentRouter` per chain.

Initial target networks:

- Ethereum Sepolia for testing
- Base Sepolia for testing
- BNB Chain testnet for testing
- production chains only after review and testnet proving

The router supports:

- EIP-712 signed payment intents
- native-token escrow
- ERC-20 escrow
- per-token rail config
- per-token fee bps
- per-token min/max amount
- per-token minimum release delay
- recipient allowlist mode
- account/token block controls
- batch release
- batch refund
- fee collector rotation
- authorizer rotation
- payout/risk operator rotation
- pause/unpause
- stuck-fund recovery that excludes active escrow

## Solana Deployment

Deploy `chivo_payments` per Solana cluster/program id.

The program supports:

- company config PDA
- SOL payment intent PDA
- SOL escrow deposit
- payout operator release
- risk/account authority freeze, unfreeze, cancel, refund
- native SOL rail fee updates
- fee collector updates
- payout operator updates
- final intent close for rent recovery
- SPL mint rail config accounts

## Automatic Payout

No manual daily payout loop is required.

The backend payout worker should:

1. Read confirmed `onchain_payment_events`.
2. Check `onchain_payment_intents.status`.
3. Check `evaluate_access_policy`.
4. Check no active `platform_entity_restrictions`.
5. Check no active payout freeze override.
6. Confirm chain finality.
7. Call EVM `releasePayment` or `releasePayments`, or Solana `release_sol`.
8. Update Supabase with release transaction/signature.

Manual release should be reserved for support correction only.

## Refunds

Refund flow:

1. Risk operator freezes payment.
2. Company review decides refund.
3. Risk operator calls refund onchain.
4. Backend records refund event.
5. Supabase revokes or blocks access pass when needed.

Refunds do not delete payment history.

## Verification Payments

Public profile and school verification use the same payment system.

Flow:

1. Create verification access product.
2. Create verification request.
3. Create onchain payment intent unless fee is waived.
4. User pays into escrow.
5. Backend verifies payment.
6. Company reviews the profile or school.
7. If approved, create verification badge.
8. Payout worker releases escrow.
9. If rejected by policy, refund or keep according to the published policy.

Badges remain database-controlled and can be revoked or expired by company admins.

## Emergency Controls

EVM:

- pause router
- disable rail
- raise recipient allowlist requirement
- block account/token
- freeze payment
- refund payment
- rotate authorizer
- rotate payout/risk operator
- rotate fee collector

Solana:

- pause program config
- disable native rail
- update fee collector
- update payout operator
- freeze intent
- refund intent
- cancel unpaid intent

## External Requirements

These cannot be completed only by editing this repo:

- independent smart-contract audit
- testnet deployment proof
- mainnet multisig setup
- private key custody policy
- incident response policy
- monitoring and alerting
- legal/refund policy text
- production RPC/WebSocket credentials
