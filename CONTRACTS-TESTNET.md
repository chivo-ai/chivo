# Chivo Contract Testnet Runbook

Current status:

- EVM production router exists for BNB and Polygon mainnet.
- Solana mainnet deploy was blocked by local toolchain install space and no real SOL.
- Testnet support is now added for BNB, Solana, and Sui.
- Sui has a new Move workspace at `chivo-sui/`.

## BNB Testnet

Workspace:

```powershell
cd E:\BESTCITY-AI\chivo-evm
```

Use `chivo-evm/.env` values:

```env
BNB_TESTNET_RPC_URL=https://bnb-testnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
EVM_PRIVATE_KEY=0x...
CHIVO_AUTHORIZER=0x...
CHIVO_FEE_COLLECTOR=0x...
CHIVO_PAYOUT_OPERATOR=0x...
CHIVO_RISK_OPERATOR=0x...
```

Deploy:

```powershell
npm run deploy:bnb-testnet | Tee-Object .\deploy-bnb-testnet.log
```

After deploy, set:

```env
CHIVO_PAYMENT_ROUTER=0x...
```

Configure the native `tBNB` rail:

```powershell
$env:CHIVO_PAYMENT_ROUTER="0x..."
$env:CHIVO_ADMIN_ACTION="set-rail"
$env:CHIVO_TOKEN="native"
$env:CHIVO_FEE_BPS="50"
$env:CHIVO_MIN_AMOUNT="0.001"
$env:CHIVO_MAX_AMOUNT="100"
$env:CHIVO_MIN_RELEASE_DELAY="900"
npm run admin:bnb-testnet
```

## Solana Test SOL

Workspace:

```powershell
cd E:\BESTCITY-AI\chivo-sol
```

Use devnet first when you need easy test SOL:

```env
SOLANA_CLUSTER=devnet
SOLANA_DEVNET_RPC_URL=https://api.devnet.solana.com
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
ANCHOR_WALLET=C:\Users\hp\.config\solana\chivo-mainnet-authority.json
CHIVO_SOL_PROGRAM_KEYPAIR=C:\Users\hp\.config\solana\chivo-payments-program.json
CHIVO_SOL_FEE_COLLECTOR=YOUR_DEVNET_FEE_COLLECTOR
CHIVO_SOL_PAYOUT_OPERATOR=YOUR_DEVNET_PAYOUT_OPERATOR
```

Airdrop:

```powershell
npm run airdrop:devnet
```

Deploy:

```powershell
npm run deploy:devnet
```

For Solana testnet instead:

```powershell
npm run airdrop:testnet
npm run deploy:testnet
```

## Sui Testnet

Workspace:

```powershell
cd E:\BESTCITY-AI\chivo-sui
```

Use `chivo-sui/.env` values:

```env
SUI_TESTNET_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_GAS_BUDGET=100000000
SUI_FEE_COLLECTOR=0x...
SUI_PAYOUT_OPERATOR=0x...
SUI_NATIVE_FEE_BPS=50
SUI_MAX_FEE_BPS=2500
SUI_AUTO_RELEASE_DELAY_MS=900000
```

Fund testnet wallet:

```powershell
npm run faucet:testnet
```

Build and publish:

```powershell
npm run build
npm run deploy:testnet
```

Put the package id from `deploy-testnet.json` into:

```env
SUI_PACKAGE_ID=0x...
```

Initialize Chivo config:

```powershell
npm run init:testnet
```

Put the created config object id from `init-testnet.json` into:

```env
SUI_CONFIG_ID=0x...
```

## Mainnet Later

The testnet design is mainnet-ready because the contract roles and config model stay the same:

- swap RPC URLs to mainnet providers
- use production keys or multisig owners
- deploy fresh chain/program/package ids
- register addresses in Supabase `contract_program_registry`
- enable rails from database settings
- keep company admin override controls in Supabase
