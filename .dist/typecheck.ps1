# @machine: Runs npm run typecheck from the repository root, throws on a nonzero exit code, and restores the caller's working directory.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repoRoot
try {
    & npm run typecheck
    if ($LASTEXITCODE -ne 0) {
        throw "npm run typecheck failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}