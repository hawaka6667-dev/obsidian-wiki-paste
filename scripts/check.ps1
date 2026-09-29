$ErrorActionPreference = 'Stop'

& (Join-Path $PSScriptRoot 'test.ps1')
& (Join-Path $PSScriptRoot 'typecheck.ps1')