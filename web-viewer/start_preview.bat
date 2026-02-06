@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo      Revitget Edge 预览启动器
echo ==========================================
echo.
echo 正在尝试启动 Microsoft Edge (允许本地文件访问模式)...
echo 注意：此模式仅用于预览本地模型，请勿用于访问未知网页。
echo.

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) else (
    set "EDGE_PATH=msedge"
)

start "" "%EDGE_PATH%" --user-data-dir="%TEMP%\Revitget_Edge_Session" --allow-file-access-from-files "%~dp0index.html"

echo 启动成功！请在弹出的浏览器窗口中查看模型。
echo.
pause