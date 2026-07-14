@echo off
chcp 65001 >nul
echo 正在启动随心记（调试模式）...
echo 如果有报错会显示在这里
echo.
"D:\wenya\sticky-note\node_modules\electron\dist\electron.exe" "D:\wenya\sticky-note"
echo.
echo 进程已退出，按任意键关闭
pause
