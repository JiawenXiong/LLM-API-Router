@echo off
REM Add LLM API Router to PATH
REM Run this script as administrator to add the installation directory to PATH

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set "INSTALL_DIR=%~dp0"
set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"

REM Check if already in PATH
echo Checking if LLM API Router is already in PATH...
echo %PATH% | findstr /C:"%INSTALL_DIR%" >nul
if %errorlevel% equ 0 (
    echo LLM API Router is already in PATH.
    goto :end
)

REM Add to user PATH
echo Adding LLM API Router to user PATH...
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USER_PATH=%%b"
if not defined USER_PATH (
    setx PATH "%INSTALL_DIR%" >nul
) else (
    setx PATH "%USER_PATH%;%INSTALL_DIR%" >nul
)

echo.
echo LLM API Router has been added to PATH.
echo Please restart your terminal for the changes to take effect.

:end
endlocal
pause
