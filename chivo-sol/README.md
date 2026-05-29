# Chivo Solana

`chivo_payments` is the Solana escrow payment program for Chivo access products.

## Program Role

- company authority initializes payment config
- company can update fee collector, payout operator, native SOL fee, and rail status without redeploying
- backend creates a payment intent account
- payer deposits SOL into the payment-intent escrow
- automated payout operator releases confirmed payments
- company can freeze, unfreeze, cancel, or refund suspicious payment intents
- program splits platform fee and receiver amount on release
- program emits deposit, release, refund, freeze, cancel, and config events
- backend listener verifies the event before Supabase creates an access pass

The app must not grant access from this event alone. Supabase remains the source of current access.

Automatic release is handled by a backend payout worker. The worker verifies Solana finality and Supabase policy, then calls `release_sol`. Admins only touch individual payments for freeze, refund, cancellation, fraud, or emergency review.

## Setup

```bash
cd chivo-sol
yarn install
anchor build
```

Recommended Alchemy mainnet environment:

```bash
ANCHOR_PROVIDER_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
SOLANA_WS_URL=wss://solana-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
ANCHOR_WALLET=C:\Users\YOUR_USER\.config\solana\chivo-mainnet-authority.json
CHIVO_SOL_PROGRAM_KEYPAIR=C:\Users\YOUR_USER\.config\solana\chivo-payments-program.json
CHIVO_SOL_PROGRAM_ID=...
CHIVO_SOL_FEE_COLLECTOR=...
CHIVO_SOL_PAYOUT_OPERATOR=...
CHIVO_SOL_NATIVE_FEE_BPS=50
CHIVO_SOL_MAX_FEE_BPS=2500
CHIVO_SOL_AUTO_RELEASE_DELAY_SECONDS=900
```

The first settlement path handles SOL payments. SPL-token rail config accounts are included now so per-token settings are part of the first architecture; SPL-token escrow settlement should follow the same deposit, release, refund, and freeze lifecycle.

## Mainnet Deploy

```bash
npm run deploy
```

The deploy script uses:

- `ANCHOR_PROVIDER_URL`
- `ANCHOR_WALLET`
- `CHIVO_SOL_PROGRAM_KEYPAIR`

## Operator Commands

After `anchor build`, the operator script reads `target/idl/chivo_payments.json`.

Initialize config:

```bash
CHIVO_SOL_ACTION=initialize npm run operator
```

Release a verified SOL escrow:

```bash
CHIVO_SOL_ACTION=release-sol \
CHIVO_SOL_INTENT_ID=0x... \
CHIVO_SOL_RECIPIENT=... \
npm run operator
```

Refund a risky SOL escrow:

```bash
CHIVO_SOL_ACTION=refund-sol \
CHIVO_SOL_INTENT_ID=0x... \
CHIVO_SOL_PAYER=... \
CHIVO_SOL_REASON=fraud \
npm run operator
```
