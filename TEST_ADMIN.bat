@echo off
echo Testing Administrator privileges...
net session >nul 2>&1
if %errorLevel% == 0 (
    echo SUCCESS: Running as Administrator!
    echo You can now install the service.
) else (
    echo ERROR: NOT running as Administrator
    echo Please right-click this file and select "Run as administrator"
)
pause
