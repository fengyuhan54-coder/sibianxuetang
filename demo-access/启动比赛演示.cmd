@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "D:\nodejs\node.exe" (
  set "DEMO_NODE=D:\nodejs\node.exe"
) else (
  set "DEMO_NODE=node.exe"
)
where "%DEMO_NODE%" >nul 2>nul
if errorlevel 1 (
  echo 需要先安装Node.js 24或以上版本。
  pause
  exit /b 1
)
echo 本机管理页：http://127.0.0.1:3212/
echo Cloudflare服务地址：http://127.0.0.1:3211
echo 请保持此窗口运行。Ctrl+C可结束本次演示服务。
"%DEMO_NODE%" start-demo.mjs
pause
