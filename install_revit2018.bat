@echo off
setlocal

cd /d "%~dp0"

set "LOG=%~dp0install_revit2018.log"
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

> "%LOG%" echo [%date% %time%] install_revit2018.bat started

echo Installing Revitget for Revit 2018...
echo Log: %LOG%
echo.

if "%~1"=="" (
  "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_revit2018.ps1" >> "%LOG%" 2>&1
) else (
  "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_revit2018.ps1" -RevitInstallDir "%~1" >> "%LOG%" 2>&1
)
set exitCode=%ERRORLEVEL%

echo.
if not "%exitCode%"=="0" (
  echo FAILED (exit code=%exitCode%).
  echo Opening log...
  start "" notepad "%LOG%"
  pause
  exit /b %exitCode%
)

echo SUCCESS.
echo Log: %LOG%
pause
