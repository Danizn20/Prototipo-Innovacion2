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

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root

if (-not (Test-Path "Front end/src-tauri")) {
  Write-Err "This script must be run from the repository root (where 'Front end' exists)."; exit 1
}

# Prepare bundled node path
$bundleNodeDir = Join-Path "Front end" "src-tauri\bundled\node"
if (Test-Path $bundleNodeDir) {
  Remove-Item $bundleNodeDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $bundleNodeDir | Out-Null

$zipName = "node-v$NodeVersion-win-$Arch.zip"
$url = "https://nodejs.org/dist/v$NodeVersion/$zipName"
$tmpZip = Join-Path $env:TEMP $zipName

Write-Ok "Downloading Node $NodeVersion from $url"
try {
  Invoke-WebRequest -Uri $url -OutFile $tmpZip -UseBasicParsing -ErrorAction Stop
} catch {
  Write-Err "Failed to download Node runtime. Check network or version. $_"; exit 1
}

Write-Ok "Extracting Node runtime to $bundleNodeDir"
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($tmpZip, $bundleNodeDir)

# The zip contains a top-level folder like node-v20.8.1-win-x64
$extracted = Get-ChildItem -Directory $bundleNodeDir | Select-Object -First 1
if ($null -eq $extracted) { Write-Err "Extraction failed."; exit 1 }

# Move contents up one level
Get-ChildItem $extracted.FullName -Force | ForEach-Object { Move-Item $_.FullName $bundleNodeDir -Force }
Remove-Item $extracted.FullName -Recurse -Force

Write-Ok "Node runtime prepared in $bundleNodeDir"

# Install backend production dependencies
Push-Location "Backend"
if (-not (Test-Path "package.json")) { Write-Err "Backend/package.json not found"; Pop-Location; exit 1 }
Write-Ok "Installing backend production deps (npm ci --production)"
npm ci --production
Pop-Location

# Build frontend
Push-Location "Front end"
Write-Ok "Installing frontend deps and building"
npm ci
npm run build
Pop-Location

# Build Tauri app
Push-Location "Front end/src-tauri"
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  Write-Err "Rust toolchain (cargo) not found. Install Rust to proceed with building the Tauri binary.";
  Pop-Location; exit 1
}

Write-Ok "Starting Tauri build (this may take some time)"
cargo build --release
if ($LASTEXITCODE -ne 0) { Write-Err "Tauri build failed"; Pop-Location; exit 1 }

Write-Ok "Tauri build complete. Binary in target/release"
Pop-Location

Write-Ok "Packaging complete. The generated installer/binary will include the bundled Node and Backend resources as configured." 
Pop-Location
