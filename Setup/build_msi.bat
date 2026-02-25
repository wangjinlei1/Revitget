@echo off
setlocal

:: Locate WiX Toolset (prefer PATH, fallback to standard install dir)
set "CANDLE=candle.exe"
set "LIGHT=light.exe"

where /q "%CANDLE%"
if %ERRORLEVEL% EQU 0 goto wix_ok

set "PF86=%ProgramFiles(x86)%"
if "%PF86%"=="" set "PF86=C:\Program Files (x86)"
set "WIX_BIN=%PF86%\WiX Toolset v3.11\bin"

if exist "%WIX_BIN%\candle.exe" (
  set "CANDLE=%WIX_BIN%\candle.exe"
  set "LIGHT=%WIX_BIN%\light.exe"
  goto wix_ok
)

echo WiX Toolset not found.
echo - Please install WiX Toolset v3.11.
echo - Or add WiX bin directory into PATH.
echo Expected default path: %WIX_BIN%
exit /b 1

:wix_ok

:: Set paths
set "SOURCE_DIR=%~dp0"
pushd "%SOURCE_DIR%"
set "OBJ_DIR=obj"
set "BIN_DIR=bin"

if not exist "%OBJ_DIR%" mkdir "%OBJ_DIR%"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

echo Compiling Product.wxs...
"%CANDLE%" -out "%OBJ_DIR%\Product.wixobj" "Product.wxs"
if %ERRORLEVEL% NEQ 0 (
    echo Compilation failed.
    popd
    exit /b 1
)

echo Linking MSI...
"%LIGHT%" -out "%BIN_DIR%\RevitgetSetup_2018-2020.msi" -ext WixUIExtension "%OBJ_DIR%\Product.wixobj"
if %ERRORLEVEL% NEQ 0 (
    echo Linking failed.
    popd
    exit /b 1
)

echo.
echo MSI created successfully at: %BIN_DIR%\RevitgetSetup_2018-2020.msi
popd
exit /b 0
