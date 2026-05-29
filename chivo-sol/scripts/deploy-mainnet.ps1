$ErrorActionPreference = "Stop"

$envPath = Join-Path (Resolve-Path ".").Path ".env"
if (Test-Path -LiteralPath $envPath) {
  Get-Content -LiteralPath $envPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) {
      return
    }

    $separator = $line.IndexOf("=")
    if ($separator -lt 1) {
      return
    }

    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim()
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

if (-not $env:ANCHOR_PROVIDER_URL) {
  throw "Set ANCHOR_PROVIDER_URL to your Solana mainnet RPC URL."
}

if (-not $env:ANCHOR_WALLET) {
  throw "Set ANCHOR_WALLET to your funded Solana authority keypair path."
}

if (-not $env:CHIVO_SOL_PROGRAM_KEYPAIR) {
  throw "Set CHIVO_SOL_PROGRAM_KEYPAIR to your program keypair path."
}

if (-not (Test-Path -LiteralPath $env:ANCHOR_WALLET)) {
  throw "ANCHOR_WALLET file was not found: $env:ANCHOR_WALLET"
}

if (-not (Test-Path -LiteralPath $env:CHIVO_SOL_PROGRAM_KEYPAIR)) {
  throw "CHIVO_SOL_PROGRAM_KEYPAIR file was not found: $env:CHIVO_SOL_PROGRAM_KEYPAIR"
}

$programId = (solana-keygen pubkey $env:CHIVO_SOL_PROGRAM_KEYPAIR).Trim()
Write-Host "Deploying chivo_payments to Solana mainnet"
Write-Host "Program ID: $programId"
Write-Host "Authority wallet: $env:ANCHOR_WALLET"
Write-Host "RPC: $env:ANCHOR_PROVIDER_URL"

$libPath = Join-Path (Resolve-Path ".").Path "programs/chivo_payments/src/lib.rs"
$anchorPath = Join-Path (Resolve-Path ".").Path "Anchor.toml"

(Get-Content -LiteralPath $libPath -Raw) `
  -replace 'declare_id!\("[^"]+"\);', "declare_id!(""$programId"");" |
  Set-Content -LiteralPath $libPath -Encoding ASCII

(Get-Content -LiteralPath $anchorPath -Raw) `
  -replace 'chivo_payments = "[^"]+"', "chivo_payments = ""$programId""" |
  Set-Content -LiteralPath $anchorPath -Encoding ASCII

anchor build
anchor deploy --provider.cluster $env:ANCHOR_PROVIDER_URL --provider.wallet $env:ANCHOR_WALLET --program-keypair $env:CHIVO_SOL_PROGRAM_KEYPAIR

Write-Host ""
Write-Host "Deployment complete."
Write-Host "Set this in chivo-sol/.env and Supabase contract registry:"
Write-Host "CHIVO_SOL_PROGRAM_ID=$programId"
