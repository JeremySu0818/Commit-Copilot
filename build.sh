#!/bin/bash

echo "[*] Starting build process for Commit-Copilot..."
echo

echo "[*] Step 1: Installing dependencies..."
echo
npm install
if [ $? -ne 0 ]; then
    echo "[!] npm install failed"
    exit 1
fi

echo
echo "[*] Step 2: Packaging VS Code Extension (.vsix)..."
echo
npx vsce package
npm run clean
if [ $? -ne 0 ]; then
    echo "[!] vsce package failed"
    exit 1
fi

echo "[*] Build completed successfully!"
echo
