param(
  [int]$MinYear = 2018,
  [int]$MaxYear = 2024,
  [int]$PreferYear = 2020,
  [string]$RevitDirMap = "",
  [switch]$SkipBuild = $false,
  [switch]$SkipMsi = $false,
  [string]$WixDir = "",
  [string]$WixVersion = "3.11.2",
  [string]$ProductVersion = "1.0.0.1",
  [string]$MsiName = "RevitgetSetup_2018-2024.msi"
)

$ErrorActionPreference = "Stop"

$script:RevitDirCache = @{}

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
  param(
    [int[]]$Years
  )
  if (-not $Years -or $Years.Count -eq 0) { throw "No build years selected." }
  foreach ($y in $Years) {
    $outDir = Join-Path $PSScriptRoot ("..\Revitget\bin\Release" + $y)
    $dll = Join-Path $outDir "Revitget.dll"
    $addin = Join-Path $outDir "Revitget.addin"
    $draco = Join-Path $outDir "DracoNet.dll"
    $json = Join-Path $outDir "Newtonsoft.Json.dll"
    if (-not (Test-Path $dll)) { throw "Missing plugin output: $dll" }
    if (-not (Test-Path $addin)) { throw "Missing plugin output: $addin" }
    if (-not (Test-Path $draco)) { throw "Missing plugin output: $draco" }
    if (-not (Test-Path $json)) { throw "Missing plugin output: $json" }
  }
}

function Ensure-Newtonsoft {
  $dll = Join-Path $PSScriptRoot "..\Revitget\Newtonsoft.Json.dll"
  if (Test-Path $dll) { return }

  $toolsDir = Join-Path $PSScriptRoot "tools"
  if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Path $toolsDir | Out-Null }

  $ver = "13.0.3"
  $pkgDir = Join-Path $toolsDir ("newtonsoft-" + $ver)
  if (-not (Test-Path $pkgDir)) { New-Item -ItemType Directory -Path $pkgDir | Out-Null }
  $nupkg = Join-Path $pkgDir ("Newtonsoft.Json." + $ver + ".nupkg")
  $zip = Join-Path $pkgDir ("Newtonsoft.Json." + $ver + ".zip")
  if ((-not (Test-Path $nupkg)) -and (-not (Test-Path $zip))) {
    $url = "https://www.nuget.org/api/v2/package/Newtonsoft.Json/$ver"
    Invoke-WebRequest -Uri $url -OutFile $nupkg
  }
  if ((Test-Path $nupkg) -and (-not (Test-Path $zip))) {
    Copy-Item -Path $nupkg -Destination $zip -Force
  }
  Expand-Archive -Path $zip -DestinationPath $pkgDir -Force

  $src = Join-Path $pkgDir "lib\net45\Newtonsoft.Json.dll"
  if (-not (Test-Path $src)) { $src = Join-Path $pkgDir "lib\net40\Newtonsoft.Json.dll" }
  if (-not (Test-Path $src)) { throw "Newtonsoft.Json.dll not found in package: $pkgDir" }

  Copy-Item -Path $src -Destination $dll -Force
}

function Parse-RevitDirMap {
  param([string]$Map)
  $dict = @{}
  if (-not $Map) { return $dict }
  $parts = $Map -split '[;|]' | Where-Object { $_ -and $_.Trim().Length -gt 0 }
  foreach ($p in $parts) {
    $kv = $p -split '=', 2
    if ($kv.Count -ne 2) { continue }
    $k = $kv[0].Trim()
    $v = $kv[1].Trim()
    if (-not $k -or -not $v) { continue }
    $y = 0
    if ([int]::TryParse($k, [ref]$y)) { $dict[$y] = $v }
  }
  return $dict
}

function Get-RevitDirForYear {
  param(
    [int]$Year,
    [hashtable]$Overrides
  )
  if ($Overrides.ContainsKey($Year)) { return $Overrides[$Year] }
  if ($script:RevitDirCache.ContainsKey($Year)) { return $script:RevitDirCache[$Year] }

  $regKeys = @(
    "HKLM:\SOFTWARE\Autodesk\Revit\Autodesk Revit $Year",
    "HKLM:\SOFTWARE\WOW6432Node\Autodesk\Revit\Autodesk Revit $Year"
  )
  foreach ($rk in $regKeys) {
    try {
      $p = Get-ItemProperty -Path $rk -ErrorAction SilentlyContinue
      if ($p) {
        $cands = @($p.InstallLocation, $p.InstallationLocation, $p.Path, $p.InstallDir) | Where-Object { $_ -and $_.ToString().Trim().Length -gt 0 }
        foreach ($c in $cands) {
          $d = $c.ToString().Trim()
          if (Is-ValidRevitInstallDir -Dir $d) { $script:RevitDirCache[$Year] = $d; return $d }
        }
      }
    }
    catch {
    }
  }

  $default = "C:\Program Files\Autodesk\Revit $Year"
  if (Is-ValidRevitInstallDir -Dir $default) { $script:RevitDirCache[$Year] = $default; return $default }

  $drives = Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Root
  foreach ($root in $drives) {
    if (-not $root) { continue }
    $c1 = Join-Path $root ("Program Files\Autodesk\Revit $Year")
    if (Is-ValidRevitInstallDir -Dir $c1) { $script:RevitDirCache[$Year] = $c1; return $c1 }
    $c2 = Join-Path $root ("Program Files (x86)\Autodesk\Revit $Year")
    if (Is-ValidRevitInstallDir -Dir $c2) { $script:RevitDirCache[$Year] = $c2; return $c2 }
    $c3 = Join-Path $root ("Autodesk\Revit $Year")
    if (Is-ValidRevitInstallDir -Dir $c3) { $script:RevitDirCache[$Year] = $c3; return $c3 }
  }

  return $default
}

function Is-ValidRevitInstallDir {
  param([string]$Dir)
  if (-not $Dir) { return $false }
  $api = Join-Path $Dir "RevitAPI.dll"
  $ui = Join-Path $Dir "RevitAPIUI.dll"
  return (Test-Path $api) -and (Test-Path $ui)
}

function Select-RevitYears {
  param(
    [int]$MinYear,
    [int]$MaxYear,
    [int]$PreferYear,
    [hashtable]$Overrides
  )
  $years = @()
  for ($y = $MinYear; $y -le $MaxYear; $y++) {
    $dir = Get-RevitDirForYear -Year $y -Overrides $Overrides
    if (Is-ValidRevitInstallDir -Dir $dir) {
      $years += $y
    }
  }
  if ($years.Count -eq 0) { throw "No Revit installations found in years $MinYear-$MaxYear. Pass -RevitDirMap to override." }
  $ordered = @()
  if ($years -contains $PreferYear) { $ordered += $PreferYear }
  foreach ($y in ($years | Sort-Object)) {
    if ($y -ne $PreferYear) { $ordered += $y }
  }
  return $ordered
}

function New-DeterministicGuid {
  param([string]$Text)
  $md5 = [System.Security.Cryptography.MD5]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $hash = $md5.ComputeHash($bytes)
    return (New-Object Guid (,$hash)).ToString()
  }
  finally {
    $md5.Dispose()
  }
}

function New-WxsContent {
  param(
    [int[]]$Years,
    [string]$ProductVersion
  )
  $upgradeCode = "ea8dc39a-5f21-4d3a-8c7e-9b2f1a6d4c5e"
  $featureRefs = ""
  foreach ($y in $Years) {
    $featureRefs += "      <ComponentGroupRef Id=`"Revit${y}Components`" />`r`n"
  }

  $dirs = ""
  foreach ($y in $Years) {
    $addinGuid = New-DeterministicGuid ("Revitget.Addin." + $y)
    $libGuid = New-DeterministicGuid ("Revitget.Lib." + $y)
    $dirs += @"
              <Directory Id="Revit$y" Name="$y">
                <Component Id="Revit${y}Addin" Guid="$addinGuid">
                  <File Id="Revit${y}AddinFile" Source="..\Revitget\bin\Release$y\Revitget.addin" KeyPath="yes" />
                </Component>
                <Directory Id="Revit${y}LibDir" Name="Revitget">
                  <Component Id="Revit${y}Lib" Guid="$libGuid">
                    <File Id="Revit${y}Dll" Source="..\Revitget\bin\Release$y\Revitget.dll" KeyPath="yes" />
                    <File Id="Revit${y}Draco" Source="..\Revitget\bin\Release$y\DracoNet.dll" />
                    <File Id="Revit${y}Json" Source="..\Revitget\bin\Release$y\Newtonsoft.Json.dll" />
                  </Component>
                </Directory>
              </Directory>

"@
  }

  $groups = ""
  foreach ($y in $Years) {
    $groups += @"
    <ComponentGroup Id="Revit${y}Components">
      <ComponentRef Id="Revit${y}Addin" />
      <ComponentRef Id="Revit${y}Lib" />
    </ComponentGroup>

"@
  }

  return @"
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*" Name="Revitget 3D Exporter" Language="1033" Version="$ProductVersion" Manufacturer="Revitget" UpgradeCode="$upgradeCode">
    <Package InstallerVersion="200" Compressed="yes" InstallScope="perMachine" />
    <MajorUpgrade DowngradeErrorMessage="A newer version of [ProductName] is already installed." />
    <MediaTemplate EmbedCab="yes" />
    <UIRef Id="WixUI_Minimal" />

    <Feature Id="ProductFeature" Title="Revitget" Level="1">
$featureRefs    </Feature>

    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="CommonAppDataFolder">
        <Directory Id="Autodesk" Name="Autodesk">
          <Directory Id="Revit" Name="Revit">
            <Directory Id="Addins" Name="Addins">
$dirs            </Directory>
          </Directory>
        </Directory>
      </Directory>
    </Directory>

$groups  </Product>
</Wix>
"@
}

if (-not $SkipBuild) {
  $msbuild = Find-Msbuild
  if (-not $msbuild) { throw "MSBuild not found. Install Visual Studio or Build Tools (MSBuild)." }

  $csproj = Join-Path $PSScriptRoot "..\Revitget\Revitget.csproj"
  if (-not (Test-Path $csproj)) { throw "Revitget.csproj not found: $csproj" }

  $overrides = Parse-RevitDirMap -Map $RevitDirMap
  $years = Select-RevitYears -MinYear $MinYear -MaxYear $MaxYear -PreferYear $PreferYear -Overrides $overrides

  Ensure-Newtonsoft
  foreach ($y in $years) {
    $dir = Get-RevitDirForYear -Year $y -Overrides $overrides
    if (-not (Is-ValidRevitInstallDir -Dir $dir)) { throw ("Invalid Revit install dir for {0}: {1}" -f $y, $dir) }
    $out = "bin\\Release$y\\"
    & $msbuild $csproj "/t:Restore,Build" "/p:Configuration=Release" "/p:Platform=x64" "/p:RevitInstallDir=$dir" "/p:OutputPath=$out" "/m"
    if ($LASTEXITCODE -ne 0) { throw ("MSBuild failed for Revit {0} (exit {1})" -f $y, $LASTEXITCODE) }
  }
}

if (-not $SkipMsi) {
  $overrides = Parse-RevitDirMap -Map $RevitDirMap
  $years = Select-RevitYears -MinYear $MinYear -MaxYear $MaxYear -PreferYear $PreferYear -Overrides $overrides
  Ensure-Binaries -Years $years

  $hasUserMsiName = $PSBoundParameters.ContainsKey("MsiName")
  if (-not $hasUserMsiName) {
    try {
      $min = ($years | Measure-Object -Minimum).Minimum
      $max = ($years | Measure-Object -Maximum).Maximum
      if ($min -and $max) {
        $MsiName = ("RevitgetSetup_{0}-{1}.msi" -f $min, $max)
      }
    } catch {}
  }

  $wix = Ensure-Wix
  $objDir = Join-Path $PSScriptRoot "obj"
  $binDir = Join-Path $PSScriptRoot "bin"
  if (-not (Test-Path $objDir)) { New-Item -ItemType Directory -Path $objDir | Out-Null }
  if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null }

  Push-Location $PSScriptRoot
  $wxsPath = Join-Path $objDir "Product.generated.wxs"
  $wixobjPath = Join-Path $objDir "Product.wixobj"
  $msiPath = Join-Path $binDir $MsiName

  Write-Host ("Packaging Revit years: " + (($years | Sort-Object) -join ", "))
  Write-Host ("MSI: " + $msiPath)

  $wxsContent = New-WxsContent -Years $years -ProductVersion $ProductVersion
  Set-Content -Path $wxsPath -Value $wxsContent -Encoding UTF8

  & $wix.candle -out $wixobjPath $wxsPath
  & $wix.light -out $msiPath -ext WixUIExtension $wixobjPath
  Pop-Location
}
