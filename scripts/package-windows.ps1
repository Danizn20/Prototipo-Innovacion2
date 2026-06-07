<#
Packaging helper for Windows (PowerShell).
This script automates:
- Downloading a portable Node runtime
- Installing backend production dependencies
- Building the frontend
- Building the Tauri app (requires Rust + cargo installed)

Run from the repository root in an elevated or developer environment.
#>

param(
  [string]$NodeVersion = '20.8.1',
  [string]$Arch = 'x64'
)

function Write-Err($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red }
function Write-Ok($msg) { Write-Host "INFO: $msg" -ForegroundColor Green }

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
Push-Location $repoRoot

if (-not (Test-Path "Frontend/src-tauri")) {
  Write-Err "This script must be run from the repository root (where 'Frontend' exists)."; exit 1
}

# Prepare sidecar node path
$binDir = Join-Path "Frontend" "src-tauri\bin"
if (-not (Test-Path $binDir)) {
  New-Item -ItemType Directory -Force -Path $binDir | Out-Null
}

$zipName = "node-v$NodeVersion-win-$Arch.zip"
$url = "https://nodejs.org/dist/v$NodeVersion/$zipName"
$tmpZip = Join-Path $env:TEMP $zipName

Write-Ok "Downloading Node $NodeVersion from $url"
try {
  Invoke-WebRequest -Uri $url -OutFile $tmpZip -UseBasicParsing -ErrorAction Stop
} catch {
  Write-Err "Failed to download Node runtime. Check network or version. $_"; exit 1
}

Write-Ok "Extracting Node runtime..."
$tmpExtracted = Join-Path $env:TEMP "node-extracted-$(Get-Random)"
if (Test-Path $tmpExtracted) { Remove-Item $tmpExtracted -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tmpExtracted | Out-Null

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($tmpZip, $tmpExtracted)

$extractedNode = Get-ChildItem -Path $tmpExtracted -Filter "node.exe" -Recurse | Select-Object -First 1
if ($null -eq $extractedNode) { Write-Err "node.exe not found in downloaded zip."; exit 1 }

$targetNodePath = Join-Path $binDir "node-x86_64-pc-windows-msvc.exe"
Copy-Item $extractedNode.FullName -Destination $targetNodePath -Force
Remove-Item $tmpExtracted -Recurse -Force

Write-Ok "Node runtime prepared as sidecar at $targetNodePath"

# Install backend production dependencies
Push-Location "Backend"
if (-not (Test-Path "package.json")) { Write-Err "Backend/package.json not found"; Pop-Location; exit 1 }
Write-Ok "Installing backend production deps (npm ci --production)"
npm ci --production
Pop-Location

# Build frontend
Push-Location "Frontend"
Write-Ok "Preparing frontend build"
if (-not (Test-Path "node_modules/.bin/vite.cmd")) {
  Write-Ok "Frontend dependencies missing; installing them now"
  npm install --no-audit --no-fund
} else {
  Write-Ok "Frontend dependencies already present; skipping reinstall"
}
npm run build
Pop-Location

# Build Tauri app
Push-Location "Frontend"
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Err "npm not found. Install Node to proceed with building the Tauri binary.";
  Pop-Location; exit 1
}

Write-Ok "Starting Tauri build (this may take some time)"
npx tauri build
if ($LASTEXITCODE -ne 0) { Write-Err "Tauri build failed"; Pop-Location; exit 1 }

Write-Ok "Tauri build complete. Moving installers to Instaladores folder..."
if (-not (Test-Path "$repoRoot\Instaladores")) {
  New-Item -ItemType Directory -Force -Path "$repoRoot\Instaladores" | Out-Null
}
Copy-Item -Path "src-tauri\target\release\bundle\msi\*.msi" -Destination "$repoRoot\Instaladores" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "src-tauri\target\release\bundle\nsis\*-setup.exe" -Destination "$repoRoot\Instaladores" -Force -ErrorAction SilentlyContinue
Pop-Location

Write-Ok "Packaging complete. Installers are available in the 'Instaladores' directory in the project root." 
Pop-Location
