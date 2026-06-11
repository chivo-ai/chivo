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
EVM_PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
CHIVO_AUTHORIZER=0xYOUR_DEPLOYER_ADDRESS
CHIVO_FEE_COLLECTOR=0xYOUR_TREASURY_OR_DEPLOYER_ADDRESS
CHIVO_PAYOUT_OPERATOR=0xYOUR_DEPLOYER_ADDRESS
CHIVO_RISK_OPERATOR=0xYOUR_DEPLOYER_ADDRESS
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
ANCHOR_WALLET=/home/codespace/.config/solana/chivo-devnet-authority.json
CHIVO_SOL_PROGRAM_KEYPAIR=/home/codespace/.config/solana/chivo-payments-program.json
CHIVO_SOL_FEE_COLLECTOR=YOUR_DEVNET_AUTHORITY_PUBKEY
CHIVO_SOL_PAYOUT_OPERATOR=YOUR_DEVNET_AUTHORITY_PUBKEY
```

Generate deploy keys in Codespaces:

```bash
mkdir -p ~/.config/solana
solana-keygen new --outfile ~/.config/solana/chivo-devnet-authority.json --force
solana-keygen new --outfile ~/.config/solana/chivo-payments-program.json --force
solana-keygen pubkey ~/.config/solana/chivo-devnet-authority.json
solana-keygen pubkey ~/.config/solana/chivo-payments-program.json
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
SUI_ACTIVE_ADDRESS=0xYOUR_ACTIVE_SUI_ADDRESS
SUI_KEYSTORE_PATH=/home/codespace/.sui/sui_config/sui.keystore
SUI_FEE_COLLECTOR=0xYOUR_ACTIVE_SUI_ADDRESS
SUI_PAYOUT_OPERATOR=0xYOUR_ACTIVE_SUI_ADDRESS
SUI_NATIVE_FEE_BPS=50
SUI_MAX_FEE_BPS=2500
SUI_AUTO_RELEASE_DELAY_MS=900000
```

Create or import the Sui deploy wallet in Codespaces:

```bash
sui client new-env --alias chivo-testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env chivo-testnet
sui client new-address ed25519
sui client active-address
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
