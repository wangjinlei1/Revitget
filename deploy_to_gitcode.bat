@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo      Revitget GitCode 部署助手
echo ==========================================
echo.
echo 正在准备将代码推送到 GitCode (CSDN)...
echo.

if not exist .git (
    echo 初始化 Git 仓库...
    git init
)

echo 添加文件到暂存区...
git add .

echo 提交更改...
git commit -m "Update Revitget with Web Viewer Replica"

echo.
echo 请输入您的 GitCode 仓库地址 (例如 https://gitcode.com/yourname/repo.git):
set /p REPO_URL=地址: 

if "%REPO_URL%"=="" (
    echo 未输入地址，脚本退出。
    pause
    exit /b
)

echo.
echo 正在设置远程仓库...
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo.
echo 正在推送到 GitCode (master 分支)...
git branch -M master
git push -u origin master

echo.
if %ERRORLEVEL% EQU 0 (
    echo 部署成功！
    echo 您现在可以在 GitCode 仓库设置中开启 Pages 服务，
    echo 并将 Source 设置为 /web-viewer 目录（如果支持）或根目录。
) else (
    echo 部署过程中遇到错误，请检查网络或仓库权限。
)

pause