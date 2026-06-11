# Chivo Contracts

Chivo AI keeps app code, EVM contracts, and Solana programs in separate workspaces:

- `app/`, `src/`, `supabase/`: Chivo AI app and backend
- `chivo-evm/`: EVM escrow contracts
- `chivo-sol/`: Solana escrow program
- `chivo-sui/`: Sui Move escrow package

The current app remains at the repository root for now. A later move into a `chivo-ai/` app folder should only happen as a deliberate repo restructure after native and web routing are checked.

The contracts do not decide current app access by themselves. They prove and escrow payment. Supabase records still decide whether access is currently allowed, revoked, suspended, waived, or overridden.

## Payment Flow

1. Chivo creates an `onchain_payment_intents` row.
2. Backend signs or creates the matching onchain payment intent.
3. User pays onchain into escrow.
4. Onchain deposit event is observed by a listener.
5. Listener verifies chain, receiver, payer, amount, token, finality, and intent status.
6. Supabase evaluates policy, restrictions, overrides, and access product status.
7. If valid, Supabase creates or activates the access pass.
8. Automated payout operator releases escrow to fee collector and school/creator receiver.
9. Risk operator freezes/refunds only when policy, fraud, or review requires it.

## Security Rules

- no access pass from unverified chain data
- no access pass from wallet state alone
- no blind trust in client-submitted transaction hashes
- replay protection on payment intents
- escrow before payout
- automated release only after finality and policy checks
- pausable contracts/programs
- platform fee receiver controlled by company authority
- token/rail settings controlled by company authority
- recipient allowlist available for high-risk rails
- blocklists for risky accounts/tokens
- stuck-fund recovery cannot withdraw active escrow
- deployment checklist before mainnet funds move
- external review before production value moves

## Current Contract Workspaces

### EVM

Workspace: `chivo-evm/`

First contract:

- `contracts/ChivoPaymentRouter.sol`

Current coverage:

- native-token escrow payments
- ERC-20 escrow payments
- EIP-712 backend-signed payment authorization
- replay and cancellation protection
- platform-fee split
- per-token rail settings
- per-token min/max payment amounts
- per-token minimum release delay
- recipient approval mode
- account/token block controls
- separate payout and risk operators
- batch release and batch refund
- pause/unpause
- fee collector and authorizer rotation
- stuck-fund recovery while protecting active escrow
- deployment, admin, and intent-signing scripts

Testnet target now available:

- BNB Smart Chain testnet (`chainId = 97`, native token `tBNB`)

### Solana

Workspace: `chivo-sol/`

First program:

- `programs/chivo_payments/src/lib.rs`

Current coverage:

- config PDA with company authority
- payout operator and fee collector controls
- native SOL rail controls
- SPL mint rail config accounts
- SOL payment intent PDA
- SOL escrow deposit
- automated SOL release
- SOL refund, freeze, unfreeze, and cancellation
- final intent close for rent recovery
- payment/config events for backend listeners

SPL-token settlement should follow the same deposit, release, refund, and freeze lifecycle already used for SOL.

Test clusters now available:

- Solana devnet for easy test SOL airdrops
- Solana testnet for validator-style testing

### Sui

Workspace: `chivo-sui/`

First package:

- `sources/payments.move`

Current coverage:

- shared company config object
- native SUI escrow payments
- platform fee bps
- payout operator and fee collector controls
- pause switch
- native rail fee and delay updates
- SUI payment intent object
- SUI escrow deposit
- automated SUI release
- SUI refund, freeze, unfreeze, and cancellation
- config/payment events for backend listeners

Testnet target now available:

- Sui testnet (`https://fullnode.testnet.sui.io:443`)

## Verification Payments

Profile and school public verification fees use the same contract flow:

- verification fee is an `access_products` row with `entity_type = 'verification'`
- onchain payment intent uses the generic escrow router/program
- company can waive the fee through `platform_access_overrides`
- company review creates `public_verification_badges`
- badges can expire or be revoked even after valid payment

Payment does not guarantee verification. It only pays for the review or plan. Company review and policy control decide badge state.
