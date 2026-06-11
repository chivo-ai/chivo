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

$rpcUrl = if ($env:SUI_TESTNET_RPC_URL) { $env:SUI_TESTNET_RPC_URL } else { "https://fullnode.testnet.sui.io:443" }
$gasBudget = if ($env:SUI_GAS_BUDGET) { $env:SUI_GAS_BUDGET } else { "100000000" }

sui client new-env --alias chivo-testnet --rpc $rpcUrl
sui client switch --env chivo-testnet
sui move build
sui client publish --gas-budget $gasBudget --json | Tee-Object -FilePath .\deploy-testnet.json

Write-Host ""
Write-Host "Sui package published. Copy the packageId from deploy-testnet.json into SUI_PACKAGE_ID."
