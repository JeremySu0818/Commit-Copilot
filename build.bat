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
    --windowed ^
    --icon="assets/icon.ico" ^
    --add-data "assets;assets" ^
    --paths "src" ^
    --name "Auto-Commit" ^
    auto-commit.py

echo.
echo.
echo.
echo [*] Building Inno Setup script...
echo.
echo.
echo.

iscc "installer.iss"

echo.
echo.
echo.
echo [*] Build completed successfully
echo.
echo.
echo.


pause
