param(
  [string]$Revit2018Dir = "",
  [string]$Revit2020Dir = "",
  [switch]$SkipBuild = $false,
  [switch]$SkipMsi = $false,
  [string]$WixDir = "",
  [string]$WixVersion = "3.11.2"
)

$ErrorActionPreference = "Stop"

function Find-Msbuild {
  $cmd = Get-Command msbuild -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Path }

  $pf86 = ${env:ProgramFiles(x86)}
  if (-not $pf86) { $pf86 = "C:\Program Files (x86)" }
  $vswhere = Join-Path $pf86 "Microsoft Visual Studio\Installer\vswhere.exe"
  if (Test-Path $vswhere) {
    $msbuild = & $vswhere -latest -products * -requires Microsoft.Component.MSBuild -find "MSBuild\**\Bin\MSBuild.exe" 2>$null | Select-Object -First 1
    if ($msbuild -and (Test-Path $msbuild)) { return $msbuild }
  }
  return ""
}

function Ensure-Wix {
  if ($WixDir) {
    $c = Join-Path $WixDir "candle.exe"
    $l = Join-Path $WixDir "light.exe"
    if ((Test-Path $c) -and (Test-Path $l)) { return @{ candle = $c; light = $l } }
  }

  $cCmd = Get-Command candle.exe -ErrorAction SilentlyContinue
  $lCmd = Get-Command light.exe -ErrorAction SilentlyContinue
  if ($cCmd -and $lCmd) { return @{ candle = $cCmd.Path; light = $lCmd.Path } }

  $toolsDir = Join-Path $PSScriptRoot "tools"
  $wixOutDir = Join-Path $toolsDir ("wix-" + $WixVersion)
  $wixBinDir = Join-Path $wixOutDir "bin"
  $c = Join-Path $wixBinDir "candle.exe"
  $l = Join-Path $wixBinDir "light.exe"
  if ((Test-Path $c) -and (Test-Path $l)) { return @{ candle = $c; light = $l } }

  if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Path $toolsDir | Out-Null }
  if (-not (Test-Path $wixOutDir)) { New-Item -ItemType Directory -Path $wixOutDir | Out-Null }

  $zipPath = Join-Path $wixOutDir "wix311-binaries.zip"
  if (-not (Test-Path $zipPath)) {
    $url = "https://github.com/wixtoolset/wix3/releases/download/wix3112rtm/wix311-binaries.zip"
    Invoke-WebRequest -Uri $url -OutFile $zipPath
  }

  Expand-Archive -Path $zipPath -DestinationPath $wixOutDir -Force
  $candidates = @($wixOutDir, (Join-Path $wixOutDir "bin"))
  $binCandidates = Get-ChildItem -Path $wixOutDir -Recurse -Directory -Filter bin -ErrorAction SilentlyContinue | Select-Object -First 3
  foreach ($d in $binCandidates) { $candidates += $d.FullName }
  foreach ($d in $candidates | Select-Object -Unique) {
    $cTry = Join-Path $d "candle.exe"
    $lTry = Join-Path $d "light.exe"
    if ((Test-Path $cTry) -and (Test-Path $lTry)) { return @{ candle = $cTry; light = $lTry } }
  }

  throw "WiX not found after download/extract (candle.exe/light.exe missing)."
}

function Ensure-Binaries {
  $p2018 = Join-Path $PSScriptRoot "..\Revitget\bin\Release2018\Revitget.dll"
  $p2020 = Join-Path $PSScriptRoot "..\Revitget\bin\Release2020\Revitget.dll"
  if ((Test-Path $p2018) -and (Test-Path $p2020)) { return }
  throw "Missing plugin outputs. Build Release2018 and Release2020 first."
}

if (-not $SkipBuild) {
  $msbuild = Find-Msbuild
  if (-not $msbuild) { throw "MSBuild not found. Install Visual Studio or Build Tools (MSBuild)." }
  if (-not $Revit2018Dir) { throw "Pass -Revit2018Dir (e.g. C:\\Program Files\\Autodesk\\Revit 2018)" }
  if (-not $Revit2020Dir) { throw "Pass -Revit2020Dir (e.g. C:\\Program Files\\Autodesk\\Revit 2020)" }

  $csproj = Join-Path $PSScriptRoot "..\Revitget\Revitget.csproj"
  if (-not (Test-Path $csproj)) { throw "Revitget.csproj not found: $csproj" }

  & $msbuild $csproj /t:Restore,Build /p:Configuration=Release /p:Platform=x64 /p:RevitInstallDir="$Revit2018Dir" /p:OutputPath="bin\\Release2018\\" /m
  & $msbuild $csproj /t:Restore,Build /p:Configuration=Release /p:Platform=x64 /p:RevitInstallDir="$Revit2020Dir" /p:OutputPath="bin\\Release2020\\" /m
}

if (-not $SkipMsi) {
  Ensure-Binaries
  $wix = Ensure-Wix
  $objDir = Join-Path $PSScriptRoot "obj"
  $binDir = Join-Path $PSScriptRoot "bin"
  if (-not (Test-Path $objDir)) { New-Item -ItemType Directory -Path $objDir | Out-Null }
  if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null }

  Push-Location $PSScriptRoot
  & $wix.candle -out (Join-Path $objDir "Product.wixobj") "Product.wxs"
  & $wix.light -out (Join-Path $binDir "RevitgetSetup_2018-2020.msi") -ext WixUIExtension (Join-Path $objDir "Product.wixobj")
  Pop-Location
}
