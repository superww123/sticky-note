' sticky-note silent launcher (no console window)
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """D:\wenya\sticky-note\node_modules\electron\dist\electron.exe"" ""D:\wenya\sticky-note""", 0, False
