# @machine: Runs test.ps1 followed by typecheck.ps1 from the repository root and restores the caller's working directory.
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