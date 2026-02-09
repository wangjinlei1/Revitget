param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$OutZip = "",
  [switch]$IncludeWebViewer,
  [switch]$IncludeSamples
)

Set-StrictMode -Version Latest

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutZip)) {
  $OutZip = Join-Path $RepoRoot "dist/edgeone-pages.zip"
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutZip) | Out-Null

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("edgeone-pages-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

try {
  $rootIndexSource = Join-Path $RepoRoot "index.html"
  if (-not (Test-Path $rootIndexSource)) {
    throw ("Missing file: " + $rootIndexSource)
  }

  $rootIndexOut = Join-Path $tempDir "index.html"
  $rootIndexContent = Get-Content -Raw -Encoding UTF8 $rootIndexSource
  if ($IncludeSamples) {
    Set-Content -Encoding UTF8 -NoNewline -Path $rootIndexOut -Value $rootIndexContent
  } else {
    $patched = $rootIndexContent -replace 'content="0; url=\./threejs/main\.html"', 'content="0; url=./threejs/index.html"'
    Set-Content -Encoding UTF8 -NoNewline -Path $rootIndexOut -Value $patched
  }

  $noJekyll = Join-Path $RepoRoot ".nojekyll"
  if (Test-Path $noJekyll) {
    Copy-Item -Force $noJekyll (Join-Path $tempDir ".nojekyll")
  }

  $threeSource = Join-Path $RepoRoot "threejs"
  $threeOut = Join-Path $tempDir "threejs"

  if ($IncludeSamples) {
    Copy-Item -Recurse -Force $threeSource $threeOut
  } else {
    New-Item -ItemType Directory -Force -Path $threeOut | Out-Null

    $threeFiles = @(
      "index.html",
      "controls_patch.js",
      "brand_patch.js",
      "vite.svg",
      "no.png"
    )

    foreach ($rel in $threeFiles) {
      $src = Join-Path $threeSource $rel
      if (Test-Path $src) {
        Copy-Item -Force $src (Join-Path $threeOut $rel)
      }
    }

    $threeDirs = @(
      "assets",
      "lib"
    )

    foreach ($relDir in $threeDirs) {
      $srcDir = Join-Path $threeSource $relDir
      if (Test-Path $srcDir) {
        Copy-Item -Recurse -Force $srcDir (Join-Path $threeOut $relDir)
      }
    }
  }

  if ($IncludeWebViewer) {
    Copy-Item -Recurse -Force (Join-Path $RepoRoot "web-viewer") (Join-Path $tempDir "web-viewer")
  }

  if (Test-Path $OutZip) {
    Remove-Item -Force $OutZip
  }

  Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $OutZip -CompressionLevel Optimal

  $zipInfo = Get-Item $OutZip
  $sizeMb = [Math]::Round($zipInfo.Length / 1MB, 2)
  Write-Host ("OK: " + $zipInfo.FullName + " (" + $sizeMb + " MB)")
} finally {
  if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
  }
}
