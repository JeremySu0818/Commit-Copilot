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
Write-Host "[*] Step 2: Compiling TypeScript..."
Write-Host ""
npm run compile
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] TypeScript compilation failed"
    exit 1
}

Write-Host ""
Write-Host "[*] Step 3: Packaging VS Code Extension (.vsix)..."
Write-Host ""
npx vsce package
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] vsce package failed"
    exit 1
}

Write-Host ""
Write-Host ""
Write-Host "[*] Build completed successfully!"
Write-Host "[*] You should see a .vsix file in the current directory."
Write-Host ""