@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0\.."

set PORT=4173

echo ==========================================
echo   Revitget threejs 本地预览 (Edge)
echo ==========================================
echo.
echo 正在启动本地静态服务...
echo 地址: http://localhost:%PORT%/threejs/index.html?model=1
echo.

start "" msedge "http://localhost:%PORT%/threejs/index.html?model=1"
python threejs/serve.py %PORT%

