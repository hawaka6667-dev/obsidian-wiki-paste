# @machine: Plans and distributes selected candidate/baseline packages to configured A/B vaults, verifies package hashes, optionally changes baseline settings, and reloads enabled copies.
param(
    [ValidateSet('Candidate', 'Baseline', 'GameDevVault', 'wiki paste', 'Both')]
    [string]$Target = 'Candidate',

    [string]$Version,

    [string]$CandidateVersion,

    [string]$BaselineVersion,

    [switch]$DisableBaselineOptions,

    [switch]$PlanOnly,

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
$targetVaults = switch ($Target) {
    { $_ -in @('Candidate', 'GameDevVault') } { [PSCustomObject]@{ Name = 'GameDevVault'; Role = 'Candidate'; Path = $mainVaultPath } }
    { $_ -in @('Baseline', 'wiki paste') } { [PSCustomObject]@{ Name = 'wiki paste'; Role = 'Baseline'; Path = $testVaultPath } }
    'Both' {
        [PSCustomObject]@{ Name = 'GameDevVault'; Role = 'Candidate'; Path = $mainVaultPath }
        [PSCustomObject]@{ Name = 'wiki paste'; Role = 'Baseline'; Path = $testVaultPath }
    }
}
$sourceManifestPath = Join-Path $testVaultPath 'manifest.json'
if (-not (Test-Path -LiteralPath $sourceManifestPath)) {
    throw "Plugin manifest source not found: $sourceManifestPath"
}
$sourceManifest = Get-Content -LiteralPath $sourceManifestPath -Raw | ConvertFrom-Json
if ($Version -and ($CandidateVersion -or $BaselineVersion)) {
    throw 'Use either -Version for every selected target or the role-specific version parameters, not both.'
}
$currentVersion = [string]$sourceManifest.version
if ($currentVersion -notmatch '^\d+(?:\.\d+)+$') {
    throw "Invalid current numeric version: '$currentVersion'"
}
$distRoot = Join-Path $testVaultPath '.dist'
if (-not (Test-Path -LiteralPath $distRoot)) {
    throw "Build directory not found: $distRoot. Run npm run build first."
}
$versionDirectories = @(Get-ChildItem -LiteralPath $distRoot -Directory |
    Where-Object { $_.Name -match '^\d+(?:\.\d+)+$' } |
    Sort-Object { [version]$_.Name } -Descending)
$previousVersionDirectory = $versionDirectories |
    Where-Object { [version]$_.Name -lt [version]$currentVersion } |
    Select-Object -First 1
$previousVersion = if ($previousVersionDirectory) { $previousVersionDirectory.Name } else { $null }
if (-not $Version -and -not $BaselineVersion -and @($targetVaults | Where-Object Role -eq 'Baseline').Count -gt 0 -and -not $previousVersion) {
    throw "No previous local package found in $distRoot. Specify -BaselineVersion or seed the previous Release package."
}

$distributionPlan = @(
    foreach ($targetVault in $targetVaults) {
        $targetVersion = if ($Version) {
            $Version
        } elseif ($targetVault.Role -eq 'Candidate') {
            if ($CandidateVersion) { $CandidateVersion } else { $currentVersion }
        } else {
            if ($BaselineVersion) { $BaselineVersion } else { $previousVersion }
        }
        if (-not $targetVersion) {
            throw "No package version selected for '$($targetVault.Role)'. Specify the role-specific version or seed the previous Release package."
        }
        if ($targetVersion -notmatch '^\d+(?:\.\d+)+$') {
            throw "Invalid numeric version: '$targetVersion'"
        }

        $releasePath = Join-Path $distRoot $targetVersion
        $manifestPath = Join-Path $releasePath 'manifest.json'
        $bundlePath = Join-Path $releasePath 'main.js'
        if (-not (Test-Path -LiteralPath $manifestPath) -or -not (Test-Path -LiteralPath $bundlePath)) {
            throw "Local package '$targetVersion' is incomplete or missing: $releasePath. Build it locally or seed this version from its GitHub Release first."
        }

        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        if ($manifest.id -ne $sourceManifest.id -or $manifest.version -ne $targetVersion) {
            throw "Package manifest does not match plugin '$($sourceManifest.id)' version '$targetVersion': $manifestPath"
        }
        if ((Get-Item -LiteralPath $bundlePath).Length -eq 0) {
            throw "Build output is empty: $bundlePath"
        }

        [PSCustomObject]@{
            Name = $targetVault.Name
            Role = $targetVault.Role
            Path = $targetVault.Path
            Version = $targetVersion
            Manifest = $manifest
            ManifestPath = $manifestPath
            BundlePath = $bundlePath
        }
    }
)
foreach ($targetVault in $distributionPlan) {
    Write-Host "Plan: $($targetVault.Name) <- .dist/$($targetVault.Version)"
}

if ($PlanOnly) {
    Write-Host 'Plan only; no vault files, settings, or runtime plugins were changed.'
    return
}

function Disable-BaselinePluginOptions {
    param([string]$VaultPath, [string]$PluginId)

    $settingsPath = Join-Path $VaultPath ".obsidian\plugins\$PluginId\data.json"
    if (Test-Path -LiteralPath $settingsPath) {
        try {
            $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
        }
        catch {
            throw "Could not parse plugin settings '$settingsPath': $($_.Exception.Message)"
        }
        if ($null -eq $settings) {
            $settings = [PSCustomObject]@{}
        }
    }
    else {
        $settings = [PSCustomObject]@{}
    }

    $settingsChanged = $false
    foreach ($settingName in @('escapeMarkdownSyntax', 'autoExpandCanvasCards', 'escapeFootnoteReferences')) {
        $setting = $settings.PSObject.Properties[$settingName]
        if ($setting) {
            if ($setting.Value -isnot [bool] -or $setting.Value) {
                $setting.Value = $false
                $settingsChanged = $true
            }
        }
        else {
            $settings | Add-Member -NotePropertyName $settingName -NotePropertyValue $false
            $settingsChanged = $true
        }
    }

    if ($settingsChanged) {
        $tempPath = "$settingsPath.tmp"
        $json = ConvertTo-Json -InputObject $settings -Depth 100
        $encoding = [System.Text.UTF8Encoding]::new($false)
        [System.IO.File]::WriteAllText($tempPath, "$json$([Environment]::NewLine)", $encoding)
        Move-Item -LiteralPath $tempPath -Destination $settingsPath -Force
    }
    Write-Host "Disabled plugin feature options in '$VaultPath'."
}

$vaultRegistryPath = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'obsidian\obsidian.json'
if (-not (Test-Path -LiteralPath $vaultRegistryPath)) {
    throw "Obsidian vault registry not found: $vaultRegistryPath"
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


foreach ($targetVault in $distributionPlan) {
    $targetVaultPath = $targetVault.Path
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
    $targetVault | Add-Member -NotePropertyName VaultId -NotePropertyValue $vaultId
}


foreach ($targetVault in $distributionPlan) {
    $destination = Join-Path $targetVault.Path ".obsidian\plugins\$($targetVault.Manifest.id)"
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Copy-Item -LiteralPath $targetVault.ManifestPath -Destination (Join-Path $destination 'manifest.json') -Force
    Copy-Item -LiteralPath $targetVault.BundlePath -Destination (Join-Path $destination 'main.js') -Force

    $sourceHash = (Get-FileHash -LiteralPath $targetVault.BundlePath -Algorithm SHA256).Hash
    $destinationHash = (Get-FileHash -LiteralPath (Join-Path $destination 'main.js') -Algorithm SHA256).Hash
    if ($sourceHash -ne $destinationHash) {
        throw "The distributed bundle hash does not match the source for '$($targetVault.Path)'."
    }
    Write-Host "Distributed '$($targetVault.Manifest.id)' version '$($targetVault.Version)' to '$($targetVault.Name)'."
    Write-Host "Bundle SHA-256: $sourceHash"
}

if ($DisableBaselineOptions) {
    foreach ($targetVault in $distributionPlan | Where-Object Role -eq 'Baseline') {
        Disable-BaselinePluginOptions -VaultPath $targetVault.Path -PluginId $targetVault.Manifest.id
    }
}

$reloadScriptPath = Join-Path $PSScriptRoot 'reload.ps1'
if (-not (Test-Path -LiteralPath $reloadScriptPath)) {
    throw "Reload script not found: $reloadScriptPath"
}
foreach ($targetVault in $distributionPlan) {
    $reloadArguments = @{
        Target = $targetVault.Role
        Version = $targetVault.Version
        ObsidianCliPath = $cli
    }

    $installedOutput = & $cli "vault=$($targetVault.VaultId)" plugins filter=community format=json 2>&1
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
    $isKnownToRuntime = @($installedPlugins | ForEach-Object { [string]$_.id }) -contains [string]$targetVault.Manifest.id
    if (-not $isKnownToRuntime) {
        Write-Host "Restart Obsidian once so it scans '$($targetVault.Name)' plugin files; reload was skipped."
        continue
    }

    $enabledOutput = & $cli "vault=$($targetVault.VaultId)" plugins:enabled filter=community format=json 2>&1
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

    $isRuntimeEnabled = @($runtimeEnabledPlugins | ForEach-Object { [string]$_.id }) -contains [string]$targetVault.Manifest.id
    if (-not $isRuntimeEnabled) {
        Write-Host "Plugin '$($targetVault.Manifest.id)' remains disabled in '$($targetVault.Name)'; reload was skipped."
        continue
    }

    Write-Host "Reloading '$($targetVault.Manifest.id)' version '$($targetVault.Version)' in '$($targetVault.Name)'."
    & $reloadScriptPath @reloadArguments
}