@echo off
REM Windows Service Uninstallation Batch Script
REM This script automatically elevates to Administrator and uninstalls the service

echo Checking for Administrator privileges...

net session >nul 2>&1
if %errorLevel% == 0 (
    echo Success: Running as Administrator
    goto :uninstall
) else (
    echo Error: Not running as Administrator
    echo Requesting elevation...

    REM Request elevation
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d %CD% && node scripts/uninstall-service.js && pause' -Verb RunAs"
    exit /b
)

:uninstall
echo Uninstalling LM Studio LAN Gateway Windows Service...
echo.

REM Change to script directory
cd /d "%~dp0.."

REM Run the uninstallation script
node scripts/uninstall-service.js

echo.
echo Press any key to exit...
pause >nul
