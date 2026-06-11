# Chivo Sui Payments

Sui testnet workspace for Chivo payment escrow.

The current package mirrors the Chivo control model used on EVM and Solana:

- company-owned config object
- native SUI escrow
- platform fee bps
- payout operator
- fee collector
- pause switch
- fee and rail updates
- release, refund, freeze, unfreeze, and cancel flows

## Testnet Flow

Install the Sui CLI, then create or import a testnet wallet.

```powershell
cd E:\BESTCITY-AI\chivo-sui
Copy-Item .env.example .env
npm run faucet:testnet
npm run build
npm run deploy:testnet
```

After publish, put the package id into `.env`:

```env
SUI_PACKAGE_ID=0x...
```

Then initialize company config:

```powershell
npm run init:testnet
```

Copy the created `Config` object id into:

```env
SUI_CONFIG_ID=0x...
```

Mainnet later should use the same module and scripts with mainnet RPC, a mainnet key, and a mainnet package id.
