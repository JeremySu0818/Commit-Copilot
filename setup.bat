@echo off
setlocal enabledelayedexpansion

echo [*] Starting setup process for Auto-Commit...

:: 檢查 uv 是否安裝
where uv >nul 2>nul
if %errorlevel% neq 0 (
    echo [^!] uv was not found on your system.
    set /p "install_uv=[?] Would you like to install uv now? (y/n): "
    
    set "is_yes="
    if /I "!install_uv!"=="y" set "is_yes=1"
    if /I "!install_uv!"=="yes" set "is_yes=1"
    
    if defined is_yes (
        echo [*] Installing uv via official script...
        powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
        
        :: 嘗試刷新路徑以立即使用 uv
        set "PATH=%PATH%;%USERPROFILE%\.cargo\bin"
        
        where uv >nul 2>nul
        if !errorlevel! neq 0 (
            echo [X] Error: uv installation failed or not found in PATH.
            pause
            exit /b 1
        )
    ) else (
        echo [X] Setup aborted. uv is required to proceed.
        pause
        exit /b 1
    )
) else (
    echo [*] uv is already installed.
)

:: 檢查 .venv 資料夾
if exist ".venv" (
    echo [*] Existing .venv detected. Removing old environment...
    rmdir /s /q ".venv"
)

:: 建立新的虛擬環境
echo [*] Creating a new virtual environment...
uv venv --clear

:: 安裝依賴項
if exist "pyproject.toml" (
    echo [*] Installing dependencies from pyproject.toml...
    uv pip install -e .
) else if exist "requirements.txt" (
    echo [*] Installing dependencies from requirements.txt...
    uv pip install -r requirements.txt
) else (
    echo [^!] Warning: No dependency file found.
)

echo.
echo [*] Setup completed successfully^!
pause