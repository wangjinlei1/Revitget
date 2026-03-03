@echo off
setlocal EnableExtensions

set SCRIPT_DIR=%~dp0
set LOG=%SCRIPT_DIR%package_msi.log

echo [package_msi] WorkingDir: %SCRIPT_DIR%
echo [package_msi] Log: %LOG%
echo.

set PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
if not exist "%PS%" set PS=powershell

pushd "%SCRIPT_DIR%" >nul

echo [package_msi] Running PowerShell...
echo.
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%package_msi.ps1" %* >> "%LOG%" 2>&1
set EXITCODE=%errorlevel%

if not "%EXITCODE%"=="0" (
  echo.
  echo [package_msi] FAILED (exit=%EXITCODE%). See log:
  echo   %LOG%
  echo.
  pause
)

popd >nul
exit /b %EXITCODE%
