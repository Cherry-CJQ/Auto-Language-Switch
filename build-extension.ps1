# Ensure script runs in PowerShell and not in cmd.exe
# Requires PowerShell 3.0 or later
# Check if PowerShell is running
if ($PSVersionTable.PSVersion.Major -lt 3) {
    Write-Error "This script requires PowerShell 3.0 or later."
    exit 1
}

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$extensionDir = Join-Path $scriptDir "vscode-extension"

Write-Host "Navigating to '$extensionDir'..."
Set-Location $extensionDir

Write-Host "Running 'npm install' for vscode-extension..."
npm install

Write-Host "Running 'npm run vscode:prepublish' to build the extension..."
npm run vscode:prepublish

Write-Host "Extension build complete."

# Navigate back to the original directory (optional, but good practice)
Set-Location $scriptDir
