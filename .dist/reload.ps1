param(
    [ValidateSet('Test', 'Main', 'Both')]
    [string]$Target = 'Test',

    [string]$ObsidianCliPath
)

$ErrorActionPreference = 'Stop'
$testVaultPath = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd([char[]]@('\', '/'))
$configPath = Join-Path $testVaultPath '.publish-config.json'
if (Test-Path -LiteralPath $configPath) {
    $publishConfig = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if (-not $publishConfig.MainVaultPath) {
        throw "MainVaultPath is missing from $configPath"
    }
    $mainVaultPath = [System.IO.Path]::GetFullPath([string]$publishConfig.MainVaultPath).TrimEnd([char[]]@('\', '/'))
}
else {
    $mainVaultPath = 'E:\GameDevVault'
}
$sourceManifestPath = Join-Path $testVaultPath 'manifest.json'
$sourceManifest = Get-Content -LiteralPath $sourceManifestPath -Raw | ConvertFrom-Json
$manifestPath = Join-Path (Join-Path $testVaultPath '.dist') "$($sourceManifest.version)\manifest.json"
$vaultRegistryPath = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'obsidian\obsidian.json'

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Plugin manifest not found: $manifestPath"
}

if (-not (Test-Path -LiteralPath $vaultRegistryPath)) {
    throw "Obsidian vault registry not found: $vaultRegistryPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if (-not $manifest.id) {
    throw "Plugin ID is missing from $manifestPath"
}

$registry = Get-Content -LiteralPath $vaultRegistryPath -Raw | ConvertFrom-Json

if ($ObsidianCliPath) {
    if (-not (Test-Path -LiteralPath $ObsidianCliPath)) {
        throw "Obsidian CLI not found: $ObsidianCliPath"
    }
    $cli = (Resolve-Path -LiteralPath $ObsidianCliPath).Path
}
else {
    $cliCommand = Get-Command obsidian, Obsidian.com -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cliCommand) {
        $cli = $cliCommand.Source
    }
    else {
        foreach ($obsidianProcess in (Get-Process -Name Obsidian -ErrorAction SilentlyContinue)) {
            if (-not $obsidianProcess.Path) {
                continue
            }

            $candidateCli = Join-Path (Split-Path -Parent $obsidianProcess.Path) 'Obsidian.com'
            if (Test-Path -LiteralPath $candidateCli) {
                $cli = (Resolve-Path -LiteralPath $candidateCli).Path
                break
            }
        }
    }

    if (-not $cli) {
        throw 'Obsidian CLI was not found on PATH or beside a running Obsidian installation. Enable the CLI in Obsidian settings or pass -ObsidianCliPath.'
    }
}

$targets = switch ($Target) {
    'Test' { @($testVaultPath) }
    'Main' { @($mainVaultPath) }
    'Both' { @($testVaultPath, $mainVaultPath) }
}

$failures = @()
foreach ($vaultRoot in $targets) {
    $matchingVaults = @(
        foreach ($vault in $registry.vaults.PSObject.Properties) {
            $registeredPath = [System.IO.Path]::GetFullPath([string]$vault.Value.path).TrimEnd([char[]]@('\', '/'))
            if ($registeredPath -ieq $vaultRoot) {
                [PSCustomObject]@{
                    Id = $vault.Name
                    Path = $registeredPath
                }
            }
        }
    )

    if ($matchingVaults.Count -ne 1) {
        $failures += "Expected exactly one registered Obsidian vault at '$vaultRoot'; found $($matchingVaults.Count)."
        continue
    }

    $vaultId = [string]$matchingVaults[0].Id
    $reportedPath = (& $cli "vault=$vaultId" vault info=path | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        $failures += "Obsidian CLI could not verify vault '$vaultId' (exit code $LASTEXITCODE)."
        continue
    }

    try {
        $reportedPath = [System.IO.Path]::GetFullPath($reportedPath).TrimEnd([char[]]@('\', '/'))
    }
    catch {
        $failures += "Obsidian CLI returned an invalid path for vault '$vaultId': '$reportedPath'."
        continue
    }

    if ($reportedPath -ine $vaultRoot) {
        $failures += "Obsidian CLI resolved vault '$vaultId' to '$reportedPath', not '$vaultRoot'."
        continue
    }

    $enabledOutput = & $cli "vault=$vaultId" plugins:enabled filter=community format=json
    $enabledExitCode = $LASTEXITCODE
    if ($enabledExitCode -ne 0) {
        $failures += "Could not list enabled plugins in '$vaultRoot' (exit code $enabledExitCode)."
        continue
    }

    try {
        $enabledPlugins = @(($enabledOutput -join [Environment]::NewLine) | ConvertFrom-Json)
    }
    catch {
        $failures += "Could not parse enabled plugins in '$vaultRoot': $($_.Exception.Message)"
        continue
    }

    $enabledIds = @($enabledPlugins | ForEach-Object { [string]$_.id })
    if ($enabledIds -notcontains [string]$manifest.id) {
        $failures += "Plugin '$($manifest.id)' is not loaded as enabled in '$vaultRoot'. For a first install, run .dist/distribute.ps1 and restart Obsidian once so it scans the new plugin folder."
        continue
    }

    Write-Host "Reloading '$($manifest.id)' in '$vaultRoot'..."
    $reloadOutput = & $cli "vault=$vaultId" plugin:reload "id=$($manifest.id)"
    $reloadExitCode = $LASTEXITCODE
    $reloadText = $reloadOutput -join [Environment]::NewLine
    if ($reloadText) {
        Write-Output $reloadText
    }

    if ($reloadExitCode -ne 0 -or $reloadText -notmatch "(?m)^Reloaded:\s*$([regex]::Escape([string]$manifest.id))\s*$") {
        $failures += "Obsidian CLI did not confirm plugin '$($manifest.id)' was reloaded in '$vaultRoot' (exit code $reloadExitCode)."
    }
}

if ($failures.Count -gt 0) {
    throw "One or more vault operations failed:`n$($failures -join [Environment]::NewLine)"
}