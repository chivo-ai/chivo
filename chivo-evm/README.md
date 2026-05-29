# Chivo EVM

`ChivoPaymentRouter` is the EVM escrow router for Chivo school, class, crew, verification, donation, and publication payments.

## Contract Role

- accepts native-token and ERC-20 escrow deposits
- requires backend-signed EIP-712 payment authorization
- prevents replay and cancelled intent reuse
- supports per-chain deployment and per-token rail settings
- supports fee updates without redeploying
- supports min/max payment amounts per rail
- supports per-rail release delay before payout
- supports recipient allowlists
- blocks risky payers, recipients, and tokens
- rejects fee-on-transfer ERC-20 tokens
- lets an automated payout operator release confirmed escrow
- lets a risk operator freeze, unfreeze, cancel, and refund risky payments
- lets the owner update authorizer, fee collector, operators, rails, and recovery controls
- protects escrowed balances from stuck-fund withdrawal

The contract proves that payment happened and controls escrow. Supabase still decides current platform access through `evaluate_access_policy`.

## Production Authority Model

- `owner`: company multisig or treasury authority. Controls protocol config and emergency recovery.
- `authorizer`: backend signer that creates EIP-712 payment authorizations.
- `payoutOperator`: automated backend worker that releases verified escrow after chain finality and policy checks.
- `riskOperator`: company risk/control signer that pauses, blocks, approves, freezes, cancels, and refunds.
- `feeCollector`: company fee wallet. Can be updated without redeploying.

The payout operator should not be the same key as the owner. The owner should be a multisig before real value is accepted.

## Automatic Payout

Payments are not manually released one by one.

Flow:

1. Backend creates `onchain_payment_intents`.
2. Backend signs the EIP-712 intent.
3. User deposits into escrow.
4. Listener verifies the deposit event and finality.
5. Supabase checks policy, bans, overrides, product status, and payment record.
6. Payout worker calls `releasePayment` or `releasePayments`.
7. Risk operator freezes/refunds only when fraud, policy, or payment review requires it.

## Setup

```bash
cd chivo-evm
npm install
cp .env.example .env
npm run compile
```

Required deployment environment:

- `ALCHEMY_API_KEY` or chain-specific RPC URL
- `EVM_PRIVATE_KEY`
- `CHIVO_AUTHORIZER`
- `CHIVO_FEE_COLLECTOR`
- `CHIVO_PAYOUT_OPERATOR`
- `CHIVO_RISK_OPERATOR`

## Deploy

```bash
npm run deploy:sepolia
npm run deploy:base-sepolia
npm run deploy:bnb-testnet
```

After deploy, store the router address in:

```bash
CHIVO_PAYMENT_ROUTER=0x...
```

## Admin Operations

Set a rail:

```bash
CHIVO_ADMIN_ACTION=set-rail \
CHIVO_TOKEN=native \
CHIVO_FEE_BPS=50 \
CHIVO_MIN_AMOUNT=0.001 \
CHIVO_MAX_AMOUNT=10 \
CHIVO_MIN_RELEASE_DELAY=900 \
npm run admin
```

Pause:

```bash
CHIVO_ADMIN_ACTION=pause npm run admin
```

Release a verified payment:

```bash
CHIVO_ADMIN_ACTION=release-payment CHIVO_INTENT_ID=0x... npm run admin
```

Refund a risky payment:

```bash
CHIVO_ADMIN_ACTION=refund-payment CHIVO_INTENT_ID=0x... CHIVO_REASON=fraud npm run admin
```

Approve a recipient when a rail requires recipient approval:

```bash
CHIVO_ADMIN_ACTION=approve-recipient CHIVO_RECIPIENT=0x... npm run admin
```
