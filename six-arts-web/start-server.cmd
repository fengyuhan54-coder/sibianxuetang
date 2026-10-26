@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
echo ==================================================
echo Six Arts - Local Web Server
echo Open http://127.0.0.1:3210 in your browser.
echo Keep this window open. Press Ctrl+C to stop.
echo ==================================================
node.exe server.mjs
echo.
echo The server has stopped. Check the messages above.
pause
exit /b
:missing_node
echo Node.js was not found. Install Node.js 24 LTS and retry.
pause
exit /b 1
