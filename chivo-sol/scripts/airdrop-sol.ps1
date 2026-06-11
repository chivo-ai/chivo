param(
  [ValidateSet("devnet", "testnet")]
  [string]$Cluster = "devnet",
  [decimal]$Amount = 2
)

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

$clusterUrl = if ($Cluster -eq "testnet") {
  if ($env:SOLANA_TESTNET_RPC_URL) { $env:SOLANA_TESTNET_RPC_URL } else { "https://api.testnet.solana.com" }
} else {
  if ($env:SOLANA_DEVNET_RPC_URL) { $env:SOLANA_DEVNET_RPC_URL } else { "https://api.devnet.solana.com" }
}

if (-not $env:ANCHOR_WALLET) {
  throw "Set ANCHOR_WALLET to the Solana keypair that should receive test SOL."
}

if (-not (Test-Path -LiteralPath $env:ANCHOR_WALLET)) {
  throw "ANCHOR_WALLET file was not found: $env:ANCHOR_WALLET"
}

$address = (solana-keygen pubkey $env:ANCHOR_WALLET).Trim()
Write-Host "Airdropping $Amount SOL to $address on $Cluster"
solana airdrop $Amount $address --url $clusterUrl
solana balance $address --url $clusterUrl
