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

if (-not $env:SUI_PACKAGE_ID) {
  throw "Set SUI_PACKAGE_ID from deploy-testnet.json before init."
}

if (-not $env:SUI_FEE_COLLECTOR) {
  throw "Set SUI_FEE_COLLECTOR."
}

if (-not $env:SUI_PAYOUT_OPERATOR) {
  throw "Set SUI_PAYOUT_OPERATOR."
}

$gasBudget = if ($env:SUI_GAS_BUDGET) { $env:SUI_GAS_BUDGET } else { "100000000" }
$maxFeeBps = if ($env:SUI_MAX_FEE_BPS) { $env:SUI_MAX_FEE_BPS } else { "2500" }
$nativeFeeBps = if ($env:SUI_NATIVE_FEE_BPS) { $env:SUI_NATIVE_FEE_BPS } else { "50" }
$delayMs = if ($env:SUI_AUTO_RELEASE_DELAY_MS) { $env:SUI_AUTO_RELEASE_DELAY_MS } else { "900000" }

sui client switch --env chivo-testnet
sui client call `
  --package $env:SUI_PACKAGE_ID `
  --module payments `
  --function initialize_config `
  --args $env:SUI_FEE_COLLECTOR $env:SUI_PAYOUT_OPERATOR $maxFeeBps $nativeFeeBps $delayMs `
  --gas-budget $gasBudget `
  --json | Tee-Object -FilePath .\init-testnet.json

Write-Host ""
Write-Host "Sui config initialized. Copy the Config object id from init-testnet.json into SUI_CONFIG_ID."
