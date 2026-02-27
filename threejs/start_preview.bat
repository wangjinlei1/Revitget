@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set PORT=5173

echo ==========================================
echo   Revitget threejs 本地预览 (Edge)
echo ==========================================
echo.
echo 正在启动本地静态服务...
echo 地址: http://localhost:%PORT%/index.html
echo.

where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo 未找到 Python（命令 python 不存在）。
  echo 请先安装 Python 3 并勾选“Add Python to PATH”，或手动用 py -3 启动。
  pause
  exit /b 1
)

netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
  echo 端口 %PORT% 已被占用（通常是上一次的服务没关）。
  echo 请先关闭旧的黑色窗口，或在任务管理器结束 python.exe 后再重试。
  pause
  exit /b 1
)

start "" /b python serve.py %PORT%
timeout /t 1 /nobreak >nul
start "" msedge "http://localhost:%PORT%/index.html"
echo.
echo 若要关闭服务，请关闭本窗口或在任务管理器结束 python.exe。
pause

