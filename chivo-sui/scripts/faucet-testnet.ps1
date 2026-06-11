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

sui client new-env --alias chivo-testnet --rpc $rpcUrl
sui client switch --env chivo-testnet
sui client faucet
sui client gas
