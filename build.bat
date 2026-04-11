@echo off
setlocal enabledelayedexpansion

echo [*] Starting build process for Commit-Copilot...

echo.
echo [*] Step 1: Installing dependencies...
echo.

call npm install
if %ERRORLEVEL% neq 0 (
    echo [!] npm install failed
    exit /b %ERRORLEVEL%
)

echo.
echo [*] Step 2: Packaging VS Code Extension (.vsix)...
echo.


call npx vsce package
call npm run clean
if %ERRORLEVEL% neq 0 (
    echo [!] vsce package failed
    exit /b %ERRORLEVEL%
)

echo [*] Build completed successfully!
echo.
