@echo off
setlocal enabledelayedexpansion

echo [*] Starting build process for Auto-Commit...

echo [*] Building Auto-Commit.exe...
echo.
echo.
echo.

uv run pyinstaller ^
    --noconfirm ^
    --onefile ^
    --console ^
    --icon="assets/icon.ico" ^
    --add-data "assets;assets" ^
    --name "auto-commit" ^
    main.py

echo.
echo.
echo.
echo [*] Build completed successfully
echo.
echo.
echo.


pause
