' sticky-note autostart launcher (开机自启，以小球模式启动)
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """D:\wenya\sticky-note\node_modules\electron\dist\electron.exe"" ""D:\wenya\sticky-note"" --start-ball", 0, False
