param(
  [int]$MinYear = 2018,
  [int]$MaxYear = 2024,
  [int]$PreferYear = 2020,
  [string]$RevitDirMap = "",
  [switch]$SkipBuild = $false,
  [switch]$SkipMsi = $false,
  [string]$WixDir = "",
  [string]$WixVersion = "3.11.2",
  [switch]$AllowDownloadWix = $false,
  [string]$ProductVersion = "1.0.0.1",
  [string]$MsiName = "RevitgetSetup_2018-2024.msi"
)

$ErrorActionPreference = "Stop"

function Log {
  param([string]$Msg)
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host ("[{0}] {1}" -f $ts, $Msg)
}

function Test-WixBinDir {
  param([string]$Dir)
  if (-not $Dir) { return $false }
  $c = Join-Path $Dir "candle.exe"
  $l = Join-Path $Dir "light.exe"
  return (Test-Path $c) -and (Test-Path $l)
}

function Get-WixCandidatesFromProgramFiles {
  $dirs = @()
  $bases = @(${env:ProgramFiles(x86)}, $env:ProgramFiles) | Where-Object { $_ -and $_.Trim().Length -gt 0 } | Select-Object -Unique
  foreach ($base in $bases) {
    try {
      $tops = Get-ChildItem -Path $base -Directory -Filter "WiX Toolset v*" -ErrorAction SilentlyContinue
      foreach ($t in $tops) {
        $bin = Join-Path $t.FullName "bin"
        $dirs += $bin
      }
    } catch {}
  }
  return $dirs | Select-Object -Unique
}

function Find-WixBinDir {
  if (Test-WixBinDir -Dir $WixDir) { return $WixDir }

  $cCmd = Get-Command candle.exe -ErrorAction SilentlyContinue
  $lCmd = Get-Command light.exe -ErrorAction SilentlyContinue
  if ($cCmd -and $lCmd) {
    $cDir = Split-Path -Parent $cCmd.Path
    $lDir = Split-Path -Parent $lCmd.Path
    if ($cDir -eq $lDir -and (Test-WixBinDir -Dir $cDir)) { return $cDir }
  }

  try {
    $wixEnv = $env:WIX
    if ($wixEnv) {
      $bin = Join-Path $wixEnv "bin"
      if (Test-WixBinDir -Dir $bin) { return $bin }
      if (Test-WixBinDir -Dir $wixEnv) { return $wixEnv }
    }
  } catch {}

  $candidates = @(
    "C:\Program Files (x86)\WiX Toolset v3.11\bin",
    "C:\Program Files\WiX Toolset v3.11\bin",
    "C:\Program Files (x86)\WiX Toolset v3.14\bin",
    "C:\Program Files\WiX Toolset v3.14\bin"
  )
  foreach ($d in $candidates) {
    if (Test-WixBinDir -Dir $d) { return $d }
  }

  foreach ($d in (Get-WixCandidatesFromProgramFiles)) {
    if (Test-WixBinDir -Dir $d) { return $d }
  }

  return ""
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildScript = Join-Path $here "build_msi.ps1"
if (-not (Test-Path $buildScript)) { throw "build_msi.ps1 not found: $buildScript" }

$resolvedWixDir = Find-WixBinDir
if (-not $resolvedWixDir -and (-not $AllowDownloadWix) -and (-not $SkipMsi)) {
  throw "WiX not found. Install WiX Toolset v3.x, or pass -WixDir '...\\bin', or re-run with -AllowDownloadWix to let build script download."
}

$args = @{
  MinYear = $MinYear
  MaxYear = $MaxYear
  PreferYear = $PreferYear
  RevitDirMap = $RevitDirMap
  SkipBuild = $SkipBuild
  SkipMsi = $SkipMsi
  WixVersion = $WixVersion
  ProductVersion = $ProductVersion
  MsiName = $MsiName
}

if ($resolvedWixDir) {
  $args["WixDir"] = $resolvedWixDir
}

Log ("Run: build_msi.ps1 MinYear={0} MaxYear={1} PreferYear={2} SkipBuild={3} SkipMsi={4} ProductVersion={5} MsiName={6}" -f $MinYear, $MaxYear, $PreferYear, $SkipBuild, $SkipMsi, $ProductVersion, $MsiName)
if ($resolvedWixDir) { Log ("WiX: " + $resolvedWixDir) } else { Log "WiX: <not set> (build script may try download)" }

& $buildScript @args
