# Drift Browser - Authenticode Signing Script
# Signs Windows executables (.exe, .dll, .msi, .ps1) using the Dorp code signing certificate

param(
    [Parameter(Mandatory=$false)]
    [string]$FilePath
)

$thumbprint = "4AC4CE79C43B8042AA99997CEBFC13380090F606"
$cert = Get-Item "Cert:\CurrentUser\My\$thumbprint" -ErrorAction SilentlyContinue

if (-not $cert) {
    Write-Host "[!] Certificate $thumbprint not found in Cert:\CurrentUser\My" -ForegroundColor Red
    exit 1
}

Write-Host "[*] Found certificate: $($cert.Subject) (Expires: $($cert.NotAfter))" -ForegroundColor Green

if ($FilePath) {
    if (Test-Path $FilePath) {
        Write-Host "[*] Signing $FilePath..." -ForegroundColor Cyan
        $sig = Set-AuthenticodeSignature -FilePath $FilePath -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
        Write-Host "[+] Result: $($sig.Status) ($($sig.StatusMessage))" -ForegroundColor Green
    } else {
        Write-Host "[!] File not found: $FilePath" -ForegroundColor Red
    }
} else {
    # Scan release folder
    $releaseDir = Join-Path $PSScriptRoot "..\release"
    if (Test-Path $releaseDir) {
        $files = Get-ChildItem -Path $releaseDir -Recurse -Include *.exe, *.dll
        foreach ($f in $files) {
            Write-Host "[*] Signing $($f.FullName)..." -ForegroundColor Cyan
            $sig = Set-AuthenticodeSignature -FilePath $f.FullName -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
            Write-Host "[+] Signed: $($f.Name) -> $($sig.Status)" -ForegroundColor Green
        }
    } else {
        Write-Host "[*] No release directory found at $releaseDir. Pass -FilePath to sign a specific file." -ForegroundColor Yellow
    }
}

