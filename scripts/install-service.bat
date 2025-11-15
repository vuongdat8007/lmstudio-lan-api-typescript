@echo off
REM Windows Service Installation Batch Script
REM This script automatically elevates to Administrator and installs the service

echo Checking for Administrator privileges...

net session >nul 2>&1
if %errorLevel% == 0 (
    echo Success: Running as Administrator
    goto :install
) else (
    echo Error: Not running as Administrator
    echo Requesting elevation...

    REM Request elevation
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d %CD% && node scripts/install-service.js && pause' -Verb RunAs"
    exit /b
)

:install
echo Installing LM Studio LAN Gateway as Windows Service...
echo.

REM Change to script directory
cd /d "%~dp0.."

REM Run the installation script
node scripts/install-service.js

echo.
echo Press any key to exit...
pause >nul
