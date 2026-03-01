@echo off
REM LLM API Router CLI Launcher
REM Usage: llm-router-cli [args]

setlocal

REM 获取脚本所在目录（安装目录）
set "APP_DIR=%~dp0"

REM 启动主程序
start "" "%APP_DIR%LLM API Router.exe" %*

endlocal