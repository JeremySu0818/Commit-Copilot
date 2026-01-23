@echo off
setlocal enabledelayedexpansion

echo [*] Starting build process for Auto-Commit...

echo.
echo [*] Step 1: Building auto-commit.exe...
echo.

uv run pyinstaller ^
    --noconfirm ^
    --onefile ^
    --console ^
    --icon="assets/icon.ico" ^
    --add-data "assets;assets" ^
    --name "auto-commit" ^
    --distpath "." ^
    main.py

if %ERRORLEVEL% neq 0 (
    echo [!] PyInstaller failed
    exit /b %ERRORLEVEL%
)

echo.
echo [*] Step 2: Preparing VSCode extension...
echo.

call npm install

echo.
echo [*] Step 3: Compiling TypeScript...
echo.

call npm run compile

echo.
echo [*] Step 4: Packaging VSIX...
echo.

:: We use --no-verify to skip checks for LICENSE, repository, etc. 
:: if they are not present in package.json
call npx vsce package

if %ERRORLEVEL% neq 0 (
    echo [!] vsce package failed
    exit /b %ERRORLEVEL%
)

echo.
echo.
echo [*] Build completed successfully!
echo [*] You should see a .vsix file and auto-commit.exe in the current directory.
echo.

pause
