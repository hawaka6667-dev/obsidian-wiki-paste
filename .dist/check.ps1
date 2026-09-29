$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repoRoot
try {
	& (Join-Path $PSScriptRoot 'test.ps1')
	& (Join-Path $PSScriptRoot 'typecheck.ps1')
}
finally {
	Pop-Location
}