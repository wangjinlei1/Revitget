param(
    [string]$SourceDir = "$PSScriptRoot\Revitget\bin\Release"
)

$ErrorActionPreference = "Stop"

# Ensure Admin privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$versions = 2018..2024
$programData = $env:ProgramData
$baseAddinsDir = Join-Path $programData "Autodesk\Revit\Addins"

if (-not (Test-Path $SourceDir)) {
    Write-Error "Source directory not found: $SourceDir. Please build the project first."
    exit 1
}

foreach ($ver in $versions) {
    $targetDir = Join-Path $baseAddinsDir $ver
    if (-not (Test-Path $targetDir)) {
        # Create directory if it doesn't exist (optional, but good for future installs)
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }

    Write-Host "Installing for Revit $ver..."

    # 1. Copy Revitget.addin
    $addinFile = Join-Path $targetDir "Revitget.addin"
    $addinContent = @"
<?xml version="1.0" encoding="utf-8"?>
<RevitAddIns>
    <AddIn Type="Application">
        <Name>Revitget</Name>
        <Assembly>Revitget/Revitget.dll</Assembly>
        <FullClassName>Revitget.App</FullClassName>
        <AddInId>ED2327C7-7A24-2BB4-1EE2-1EEF5A367576</AddInId>
        <VendorId>ADSK</VendorId>
        <VendorDescription>Revitget Exporter</VendorDescription>
    </AddIn>
</RevitAddIns>
"@
    Set-Content -Path $addinFile -Value $addinContent -Encoding UTF8

    # 2. Copy Libs
    $libDir = Join-Path $targetDir "Revitget"
    if (-not (Test-Path $libDir)) {
        New-Item -ItemType Directory -Force -Path $libDir | Out-Null
    }

    Copy-Item -Path (Join-Path $SourceDir "Revitget.dll") -Destination $libDir -Force
    Copy-Item -Path (Join-Path $SourceDir "DracoNet.dll") -Destination $libDir -Force
    if (Test-Path (Join-Path $SourceDir "Newtonsoft.Json.dll")) {
        Copy-Item -Path (Join-Path $SourceDir "Newtonsoft.Json.dll") -Destination $libDir -Force
    }
}

Write-Host "Installation Complete for Revit 2018-2024."
Write-Host "Note: Revit 2025+ uses .NET 8, which requires a different build."
Pause
