# @machine: Runs npm test from the repository root, throws on a nonzero exit code, and restores the caller's working directory.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repoRoot
try {
    & npm test
    if ($LASTEXITCODE -ne 0) {
        throw "npm test failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}