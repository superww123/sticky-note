@echo off
cd /d "%~dp0\.."
echo 正在重新编译随心记界面...
npx vite build
echo.
echo 编译完成！请重启随心记 app（右键托盘退出后重新打开）
pause
