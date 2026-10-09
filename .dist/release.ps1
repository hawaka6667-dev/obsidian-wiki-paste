<#
@machine: Publishes the existing .dist/<version> Obsidian plugin bundle, manifest, and stylesheet as GitHub release assets, after validating repository, tag, and GitHub CLI state.
版本是单调递增的，Git标签检查可以skip
#>
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$sourceManifestPath = Join-Path $projectRoot "manifest.json"
$sourceManifest = Get-Content -Raw $sourceManifestPath | ConvertFrom-Json
$version = [string]$sourceManifest.version
if ($version -notmatch '^\d+(?:\.\d+)+$') {
    throw "Invalid plugin version: '$version'"
}

$packageJson = Get-Content -Raw (Join-Path $projectRoot "package.json") | ConvertFrom-Json
if ($packageJson.version -ne $version) {
    throw "package.json version '$($packageJson.version)' does not match manifest version '$version'."
}

$releaseDirectory = Join-Path $PSScriptRoot $version
$manifestPath = Join-Path $releaseDirectory "manifest.json"
$bundlePath = Join-Path $releaseDirectory "main.js"
$stylesPath = Join-Path $releaseDirectory "styles.css"
if (-not (Test-Path -LiteralPath $manifestPath) -or -not (Test-Path -LiteralPath $bundlePath) -or -not (Test-Path -LiteralPath $stylesPath)) {
    throw "Existing plugin bundle not found for version '$version': $releaseDirectory"
}

$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
if ($manifest.id -ne $sourceManifest.id -or $manifest.version -ne $version) {
    throw "Existing package manifest does not match plugin '$($sourceManifest.id)' version '$version': $manifestPath"
}
if ((Get-Item -LiteralPath $bundlePath).Length -eq 0) {
    throw "Plugin bundle is empty: $bundlePath"
}

$tag = $version

if ((git branch --show-current) -ne "main") {
    throw "Releases must be published from main."
}

$unexpectedChanges = git status --porcelain | Where-Object {
    $_ -notmatch '^ [M?] \.codegraph/' -and
    $_ -notmatch '^\?\? \.feedback/Snipaste_'
}
if ($unexpectedChanges) {
    throw "Commit or stash release changes before publishing:`n$($unexpectedChanges -join "`n")"
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI is required to publish a release."
}
& gh auth status
if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI authentication failed."
}

& git push origin main
if ($LASTEXITCODE -ne 0) {
    throw "Failed to push main."
}

$headCommit = git rev-parse HEAD
$tagCommit = git rev-parse -q --verify "$tag^{}" 2>$null
if ($tagCommit) {
    if ($tagCommit -ne $headCommit) {
        throw "$tag already exists and does not point to HEAD."
    }
} else {
    & git tag -a $tag -m "Release $tag"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create $tag."
    }
}

& git push origin $tag
if ($LASTEXITCODE -ne 0) {
    throw "Failed to push $tag."
}

$ErrorActionPreference = "Continue"
& gh release view $tag *> $null
$releaseExists = $LASTEXITCODE -eq 0
$ErrorActionPreference = "Stop"

if ($releaseExists) {
    & gh release upload $tag $bundlePath $manifestPath $stylesPath --clobber
} else {
    & gh release create $tag $bundlePath $manifestPath $stylesPath --title "Wiki Paste $tag" --generate-notes
}
if ($LASTEXITCODE -ne 0) {
    throw "Failed to publish GitHub release $tag."
}

$releaseUrl = gh release view $tag --json url --jq .url
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($releaseUrl)) {
    Write-Warning "Release $tag was published, but its URL could not be retrieved."
    $releaseUrl = "(URL unavailable)"
}

Write-Host ""
Write-Host "Release complete"
Write-Host "Version: $tag"
Write-Host "Uploaded plugin bundle: $bundlePath"
Write-Host "Uploaded plugin manifest: $manifestPath"
Write-Host "Uploaded plugin stylesheet: $stylesPath"
Write-Host "Release URL: $releaseUrl"
