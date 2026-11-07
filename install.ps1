# Installs the latest Drift release on Windows.
#   irm https://raw.githubusercontent.com/dor2500/drift-browser/main/install.ps1 | iex
# Downloads Drift-Setup-x.y.z.exe from GitHub Releases, installs it for the
# current user (no admin needed) and starts Drift. Later versions arrive through
# Drift's built-in updater.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = 'dor2500/drift-browser'

Write-Host 'Finding the latest Drift release...'
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'drift-installer' }
$asset = $release.assets | Where-Object { $_.name -match '^Drift-Setup-.*\.exe$' } | Select-Object -First 1
if (-not $asset) { throw "No Windows installer found in release $($release.tag_name)." }

$installer = Join-Path $env:TEMP $asset.name
Write-Host "Downloading $($asset.name) ($([math]::Round($asset.size / 1MB)) MB)..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $installer -UseBasicParsing

# Verify the download against the release's SHA256SUMS before running it, so a
# tampered release asset can't be executed. Fails closed when the file is listed
# but the hash doesn't match, or when it's missing from an existing manifest.
$sums = $release.assets | Where-Object { $_.name -eq 'SHA256SUMS' } | Select-Object -First 1
if ($sums) {
  $sumsText = (Invoke-WebRequest -Uri $sums.browser_download_url -UseBasicParsing).Content
  $line = ($sumsText -split "`n") | Where-Object { $_ -match ('\s' + [regex]::Escape($asset.name) + '\s*$') } | Select-Object -First 1
  if (-not $line) { Remove-Item $installer -Force -ErrorAction SilentlyContinue; throw "$($asset.name) is not listed in SHA256SUMS; refusing to install." }
  $expected = ($line.Trim() -split '\s+')[0]
  $actual = (Get-FileHash -Algorithm SHA256 -Path $installer).Hash
  if ($actual.ToLower() -ne $expected.ToLower()) {
    Remove-Item $installer -Force -ErrorAction SilentlyContinue
    throw "Checksum mismatch for $($asset.name) (expected $expected, got $actual). Refusing to install."
  }
  Write-Host 'Checksum verified.'
} else {
  Write-Host 'WARNING: this release has no SHA256SUMS; skipping integrity check.'
}

Write-Host 'Installing...'
Start-Process -FilePath $installer -ArgumentList '/S' -Wait
Remove-Item $installer -Force -ErrorAction SilentlyContinue

$exe = Join-Path $env:LOCALAPPDATA 'Programs\Drift\Drift.exe'
if (Test-Path $exe) {
  Write-Host "Drift $($release.tag_name) is installed. Starting it..."
  Start-Process -FilePath $exe
} else {
  Write-Host "Drift $($release.tag_name) is installed. Open it from the Start menu."
}
