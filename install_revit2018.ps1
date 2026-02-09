param(
  [string]$RevitInstallDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  $argsList = @(
    "-NoProfile"
    "-ExecutionPolicy", "Bypass"
    "-File", "`"$PSCommandPath`""
  )
  if ($RevitInstallDir) {
    $argsList += @("-RevitInstallDir", "`"$RevitInstallDir`"")
  }
  Start-Process -FilePath "powershell.exe" -ArgumentList $argsList -Verb RunAs
  exit 0
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Join-Path $repoRoot "Revitget\\Revitget.csproj"
$projectOutputDir = Join-Path (Join-Path $repoRoot "Revitget") "bin\\Release"

function Get-Revit2018InstallDir {
  if ($RevitInstallDir -and (Test-Path (Join-Path $RevitInstallDir "RevitAPI.dll"))) {
    return $RevitInstallDir
  }
  if ($env:REVIT_2018_DIR -and (Test-Path (Join-Path $env:REVIT_2018_DIR "RevitAPI.dll"))) {
    return $env:REVIT_2018_DIR
  }

  $candidates = @()
  if ($env:ProgramFiles) {
    $candidates += (Join-Path $env:ProgramFiles "Autodesk\Revit 2018")
  }
  $candidates += @(
    "D:\\Program Files\\Autodesk\\Revit 2018",
    "E:\\Program Files\\Autodesk\\Revit 2018"
  ) | Select-Object -Unique

  foreach ($dir in $candidates) {
    if (Test-Path (Join-Path $dir "RevitAPI.dll")) {
      return $dir
    }
  }

  throw "Revit 2018 install dir not found. Set env REVIT_2018_DIR to a folder containing RevitAPI.dll."
}

function Get-MSBuildPath {
  $vswhere = $null
  if (${env:ProgramFiles(x86)}) {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\\Installer\\vswhere.exe"
  }
  if (Test-Path $vswhere) {
    $msbuild = & $vswhere -latest -products * -requires Microsoft.Component.MSBuild -find "MSBuild\**\Bin\MSBuild.exe" 2>$null | Select-Object -First 1
    if ($msbuild -and (Test-Path $msbuild)) { return $msbuild }
  }

  $fallbacks = @(
    (Join-Path $env:ProgramFiles "Microsoft Visual Studio\\2022\\BuildTools\\MSBuild\\Current\\Bin\\MSBuild.exe"),
    (Join-Path $env:ProgramFiles "Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\\2019\\BuildTools\\MSBuild\\Current\\Bin\\MSBuild.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\\2019\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe")
  )

  foreach ($p in $fallbacks) {
    if (Test-Path $p) { return $p }
  }

  throw "MSBuild not found. Install Visual Studio or Build Tools (with MSBuild component)."
}

$revitDir = Get-Revit2018InstallDir
$msbuild = Get-MSBuildPath

Write-Host "Revit 2018: $revitDir"
Write-Host "MSBuild: $msbuild"
Write-Host "Restoring and building..."

& $msbuild $projectPath /t:Restore /p:Configuration=Release /p:Platform=AnyCPU /p:RevitInstallDir="$revitDir" /m
& $msbuild $projectPath /t:Build /p:Configuration=Release /p:Platform=AnyCPU /p:RevitInstallDir="$revitDir" /m

if (!(Test-Path $projectOutputDir)) {
  throw "Build output not found: $projectOutputDir"
}

$addinRoot = Join-Path $env:ProgramData "Autodesk\Revit\Addins\2018"
$addinDir = Join-Path $addinRoot "Revitget"
$addinFile = Join-Path $addinRoot "Revitget.addin"

New-Item -ItemType Directory -Force -Path $addinDir | Out-Null

$revitProc = Get-Process -Name Revit -ErrorAction SilentlyContinue
if ($revitProc) {
  throw "Revit is running. Close Revit 2018 and re-run this installer."
}

function Copy-WithRetry {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [int]$RetryCount = 20,
    [int]$DelayMs = 500
  )

  for ($i = 0; $i -lt $RetryCount; $i++) {
    try {
      Copy-Item -Force $Source $Destination
      return
    } catch [System.IO.IOException] {
      if ($i -eq ($RetryCount - 1)) { throw }
      Start-Sleep -Milliseconds $DelayMs
    }
  }
}

$filesToCopy = @(
  "Revitget.dll",
  "DracoNet.dll",
  "Newtonsoft.Json.dll"
)

foreach ($name in $filesToCopy) {
  $src = Join-Path $projectOutputDir $name
  if (Test-Path $src) {
    Copy-WithRetry -Source $src -Destination (Join-Path $addinDir $name)
  }
}

$assemblyPath = Join-Path $addinDir "Revitget.dll"
if (!(Test-Path $assemblyPath)) {
  throw "Install failed: missing $assemblyPath"
}

$addinLines = @(
  '<?xml version="1.0" encoding="utf-8"?>'
  '<RevitAddIns>'
  '    <AddIn Type="Application">'
  '        <Name>Revitget</Name>'
  "        <Assembly>$assemblyPath</Assembly>"
  '        <FullClassName>Revitget.App</FullClassName>'
  '        <AddInId>ED2327C7-7A24-2BB4-1EE2-1EEF5A367576</AddInId>'
  '        <VendorId>ADSK</VendorId>'
  '        <VendorDescription>Revitget</VendorDescription>'
  '    </AddIn>'
  '</RevitAddIns>'
)

Set-Content -Encoding UTF8 -Path $addinFile -Value ($addinLines -join "`r`n")

Write-Host "Done. Installed to:"
Write-Host " - $addinDir"
Write-Host " - $addinFile"
Write-Host "Start Revit 2018 to load the addin."
