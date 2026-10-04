# @machine: Resolves Test/Main/Both vaults, verifies build and Obsidian CLI identity, copies manifest and bundle, checks SHA-256, and reloads only enabled plugin copies.
param(
    [ValidateSet('Test', 'Main', 'Both')]
    [string]$Target = 'Both',

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
$targetVaultPaths = switch ($Target) {
    'Test' { @($testVaultPath) }
    'Main' { @($mainVaultPath) }
    'Both' { @($testVaultPath, $mainVaultPath) }
}
$sourceManifestPath = Join-Path $testVaultPath 'manifest.json'
if (-not (Test-Path -LiteralPath $sourceManifestPath)) {
    throw "Plugin manifest source not found: $sourceManifestPath"
}
$sourceManifest = Get-Content -LiteralPath $sourceManifestPath -Raw | ConvertFrom-Json
$releasePath = Join-Path (Join-Path $testVaultPath '.dist') ([string]$sourceManifest.version)
$manifestPath = Join-Path $releasePath 'manifest.json'
$bundlePath = Join-Path $releasePath 'main.js'
$vaultRegistryPath = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'obsidian\obsidian.json'

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Versioned build manifest not found: $manifestPath. Run npm run build first."
}
if (-not (Test-Path -LiteralPath $bundlePath)) {
    throw "Build output not found: $bundlePath. Run npm run build first."
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
        $cli = if ($cliCommand.Source) { $cliCommand.Source } else { $cliCommand.Path }
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

foreach ($targetVaultPath in $targetVaultPaths) {
    $matchingVaults = @(
        foreach ($vault in $registry.vaults.PSObject.Properties) {
            $registeredPath = [System.IO.Path]::GetFullPath([string]$vault.Value.path).TrimEnd([char[]]@('\', '/'))
            if ($registeredPath -ieq $targetVaultPath) {
                [PSCustomObject]@{
                    Id = $vault.Name
                    Path = $registeredPath
                }
            }
        }
    )

    if ($matchingVaults.Count -ne 1) {
        throw "Expected exactly one registered Obsidian vault at '$targetVaultPath'; found $($matchingVaults.Count)."
    }

    $vaultId = [string]$matchingVaults[0].Id
    $reportedPath = (& $cli "vault=$vaultId" vault info=path | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "Obsidian CLI could not verify vault '$vaultId' (exit code $LASTEXITCODE)."
    }

    try {
        $reportedPath = [System.IO.Path]::GetFullPath($reportedPath).TrimEnd([char[]]@('\', '/'))
    }
    catch {
        throw "Obsidian CLI returned an invalid vault path: '$reportedPath'"
    }

    if ($reportedPath -ine $targetVaultPath) {
        throw "Obsidian CLI resolved vault '$vaultId' to '$reportedPath', not '$targetVaultPath'."
    }

    $destination = Join-Path $targetVaultPath ".obsidian\plugins\$($manifest.id)"
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $destination 'manifest.json') -Force
    Copy-Item -LiteralPath $bundlePath -Destination (Join-Path $destination 'main.js') -Force

    $sourceHash = (Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash
    $destinationHash = (Get-FileHash -LiteralPath (Join-Path $destination 'main.js') -Algorithm SHA256).Hash
    if ($sourceHash -ne $destinationHash) {
        throw "The distributed bundle hash does not match the source for '$targetVaultPath'."
    }

    $installedOutput = & $cli "vault=$vaultId" plugins filter=community format=json 2>&1
    $installedExitCode = $LASTEXITCODE
    $installedText = $installedOutput -join [Environment]::NewLine
    if ($installedExitCode -ne 0 -or $installedText -match '(?m)^Error:') {
        throw "Obsidian CLI could not list installed community plugins: $installedText"
    }

    try {
        $installedPlugins = @(($installedOutput -join [Environment]::NewLine) | ConvertFrom-Json)
    }
    catch {
        throw "Obsidian CLI returned invalid JSON for installed plugins: $($_.Exception.Message)"
    }
    $isKnownToRuntime = @($installedPlugins | ForEach-Object { [string]$_.id }) -contains [string]$manifest.id

    Write-Host "Distributed '$($manifest.id)' to '$targetVaultPath'."
    Write-Host "Bundle SHA-256: $sourceHash"
    if (-not $isKnownToRuntime) {
        Write-Host "Plugin files were copied. Restart Obsidian once so it scans the new plugin folder; reload was skipped and the enabled state was not changed."
        continue
    }

    $enabledOutput = & $cli "vault=$vaultId" plugins:enabled filter=community format=json 2>&1
    $enabledExitCode = $LASTEXITCODE
    $enabledText = $enabledOutput -join [Environment]::NewLine
    if ($enabledExitCode -ne 0 -or $enabledText -match '(?m)^Error:') {
        throw "Obsidian CLI could not list enabled community plugins: $enabledText"
    }

    try {
        $runtimeEnabledPlugins = @(($enabledOutput -join [Environment]::NewLine) | ConvertFrom-Json)
    }
    catch {
        throw "Obsidian CLI returned invalid JSON for enabled plugins: $($_.Exception.Message)"
    }

    $isRuntimeEnabled = @($runtimeEnabledPlugins | ForEach-Object { [string]$_.id }) -contains [string]$manifest.id
    if (-not $isRuntimeEnabled) {
        Write-Host "Plugin '$($manifest.id)' remains disabled in '$targetVaultPath'; reload was skipped."
        continue
    }

    $reloadTarget = if ($targetVaultPath -ieq $testVaultPath) { 'Test' } else { 'Main' }
    $reloadScriptPath = Join-Path $PSScriptRoot 'reload.ps1'
    if (-not (Test-Path -LiteralPath $reloadScriptPath)) {
        throw "Reload script not found: $reloadScriptPath"
    }

    Write-Host "Reloading enabled plugin '$($manifest.id)' in '$targetVaultPath'."
    & $reloadScriptPath -Target $reloadTarget -ObsidianCliPath $cli
}