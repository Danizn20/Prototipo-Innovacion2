Set WshShell = CreateObject("WScript.Shell")
' El parámetro 0 oculta la ventana. El False es para que el script no espere a que el bat termine.
WshShell.Run "run.bat", 0, False
Set WshShell = Nothing