# Chivo Contract Production Runbook

This runbook covers the contract-side controls needed before Chivo accepts real value on EVM, Solana, or Sui.

Initial production scope is crypto payments, escrow, ownership-provider records, funding, donations, and paid access. It does not include creator coins or custom Chivo platform tokens.

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

Current active production network:

- Polygon mainnet

Staged target networks:

- BNB Smart Chain mainnet

Testnet target:

- BNB Smart Chain testnet

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

Test clusters:

- Solana devnet for test SOL and app integration checks
- Solana testnet for cluster testing

## Sui Deployment

Deploy `chivo_payments` per Sui network/package id.

The package supports:

- company config object
- native SUI escrow deposit
- payout operator release
- company authority freeze, unfreeze, cancel, refund
- native SUI rail fee updates
- fee collector updates
- payout operator updates
- payment/config events

Test network:

- Sui testnet

## Automatic Payout

No manual daily payout loop is required.

The backend payout worker should:

1. Read confirmed `onchain_payment_events`.
2. Check `onchain_payment_intents.status`.
3. Confirm chain finality.
4. For access intents, check `evaluate_access_policy`.
5. For funding intents, confirm the linked `funding_contributions` row before release.
6. For donation intents, confirm donation metadata before release.
7. Check no active `platform_entity_restrictions`.
8. Check no active payout freeze override.
9. Call EVM `releasePayment` or `releasePayments`, Solana `release_sol`, or Sui `release_sui`.
10. Update Supabase with release transaction/signature.

Manual release should be reserved for support correction only.

Current EVM worker default:

- `DEFAULT_EVM_PAYOUT_CHAIN=polygon-mainnet`
- `PAYMENT_LISTENER_SECRET` triggers the EVM event listener.
- `EVM_AUTHORIZER_PRIVATE_KEY` signs checkout authorizations and must match the router authorizer.
- `EVM_POLYGON_MAINNET_RPC_URL` should point to the Alchemy Polygon mainnet RPC URL.
- `EVM_POLYGON_MAINNET_MIN_CONFIRMATIONS` controls how many confirmations are required before granting access.
- `EVM_POLYGON_MAINNET_LISTENER_LOOKBACK_BLOCKS` controls how far the listener searches for pending intent deposits.
- `EVM_POLYGON_MAINNET_PAYMENT_ROUTER_ADDRESS` can be set as an env override, but the worker can also resolve the active router from `contract_program_registry`.

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
- mainnet dry-run checklist and deployment record
- mainnet multisig setup
- private key custody policy
- incident response policy
- monitoring and alerting
- legal/refund policy text
- production RPC/WebSocket credentials
