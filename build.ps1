Write-Host "[*] Starting build process for Commit-Copilot..."
Write-Host ""

Write-Host "[*] Step 1: Installing dependencies..."
Write-Host ""
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] npm install failed"
    exit 1
}

Write-Host ""
Write-Host "[*] Step 2: Packaging VS Code Extension (.vsix)..."
Write-Host ""
npx vsce package
npm run clean
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] vsce package failed"
    exit 1
}

Write-Host ""
Write-Host ""
Write-Host "[*] Build completed successfully!"
Write-Host ""
