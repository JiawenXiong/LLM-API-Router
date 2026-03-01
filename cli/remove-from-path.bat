@echo off
REM Remove LLM API Router from PATH
REM Run this script to remove the installation directory from PATH

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set "INSTALL_DIR=%~dp0"
set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"

REM Remove from user PATH
echo Removing LLM API Router from user PATH...
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USER_PATH=%%b"

if defined USER_PATH (
    REM Remove the install directory from PATH
    set "NEW_PATH=!USER_PATH:%INSTALL_DIR%=!"
    set "NEW_PATH=!NEW_PATH:;;=;!"
    set "NEW_PATH=!NEW_PATH:; =;!"
    set "NEW_PATH=!NEW_PATH: ;=;!"
    if "!NEW_PATH:~0,1!"==";" set "NEW_PATH=!NEW_PATH:~1!"
    if "!NEW_PATH:~-1!"==";" set "NEW_PATH=!NEW_PATH:~0,-1!"
    
    setx PATH "!NEW_PATH!" >nul
    echo LLM API Router has been removed from PATH.
) else (
    echo No user PATH found.
)

echo Please restart your terminal for the changes to take effect.

endlocal
pause
