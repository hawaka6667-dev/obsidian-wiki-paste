param(
    [ValidateSet('Test', 'Main', 'Both')]
    [string]$Target = 'Main',

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
$manifestPath = Join-Path $testVaultPath 'manifest.json'
$bundlePath = Join-Path $testVaultPath 'main.js'
$vaultRegistryPath = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'obsidian\obsidian.json'

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Plugin manifest not found: $manifestPath"
}
if (-not (Test-Path -LiteralPath $bundlePath)) {
    throw "Build output not found: $bundlePath. Run scripts/build.ps1 first."
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

    $communityPluginsPath = Join-Path $targetVaultPath '.obsidian\community-plugins.json'
    $enabledIds = @()
    if (Test-Path -LiteralPath $communityPluginsPath) {
        try {
            $enabledIds = @((Get-Content -LiteralPath $communityPluginsPath -Raw | ConvertFrom-Json))
        }
        catch {
            throw "Could not parse enabled plugin list '$communityPluginsPath': $($_.Exception.Message)"
        }
    }

    if ($enabledIds -notcontains [string]$manifest.id) {
        $enabledIds += [string]$manifest.id
        $temporarySettingsPath = "$communityPluginsPath.tmp"
        $enabledJson = ConvertTo-Json -InputObject ([string[]]$enabledIds)
        Set-Content -LiteralPath $temporarySettingsPath -Value $enabledJson -Encoding UTF8
        Move-Item -LiteralPath $temporarySettingsPath -Destination $communityPluginsPath -Force
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
        Write-Host "Added '$($manifest.id)' to the enabled plugin list. Restart Obsidian once so it scans the newly copied plugin files."
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
        $enableOutput = & $cli "vault=$vaultId" plugin:enable "id=$($manifest.id)" filter=community 2>&1
        $enableExitCode = $LASTEXITCODE
        $enableText = $enableOutput -join [Environment]::NewLine
        if ($enableExitCode -ne 0 -or $enableText -match '(?m)^Error:') {
            throw "Plugin files were distributed, but Obsidian could not enable '$($manifest.id)': $enableText"
        }

        $verifyOutput = & $cli "vault=$vaultId" plugins:enabled filter=community format=json 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Obsidian CLI could not verify that '$($manifest.id)' was enabled."
        }
        $verifiedEnabledIds = @((($verifyOutput -join [Environment]::NewLine) | ConvertFrom-Json) | ForEach-Object { [string]$_.id })
        if ($verifiedEnabledIds -notcontains [string]$manifest.id) {
            throw "Obsidian CLI did not confirm that '$($manifest.id)' was enabled."
        }
    }

    Write-Host "Plugin '$($manifest.id)' is enabled in '$targetVaultPath'."
}