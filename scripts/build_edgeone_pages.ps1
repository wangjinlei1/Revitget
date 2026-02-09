param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$OutZip = "",
  [switch]$IncludeWebViewer
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
  Copy-Item -Force (Join-Path $RepoRoot "index.html") (Join-Path $tempDir "index.html")

  $noJekyll = Join-Path $RepoRoot ".nojekyll"
  if (Test-Path $noJekyll) {
    Copy-Item -Force $noJekyll (Join-Path $tempDir ".nojekyll")
  }

  Copy-Item -Recurse -Force (Join-Path $RepoRoot "threejs") (Join-Path $tempDir "threejs")

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
