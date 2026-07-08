# setup.ps1 - Create desktop shortcut + register auto-start for sticky-note app
param()
$ErrorActionPreference = "Stop"

$ProjectDir  = (Split-Path -Parent $PSScriptRoot) -replace '/', '\'
$ElectronExe = Join-Path $ProjectDir "node_modules\electron\dist\electron.exe"
$DistFile    = Join-Path $ProjectDir "dist\renderer\index.html"

Write-Host "=== sticky-note setup ===" -ForegroundColor Cyan
Write-Host "ProjectDir: $ProjectDir"

# 1. Check electron.exe
if (-not (Test-Path $ElectronExe)) {
  Write-Host "[ERROR] electron.exe not found. Run: bash scripts/install.sh" -ForegroundColor Red
  exit 1
}

# 2. Build renderer if not built
if (-not (Test-Path $DistFile)) {
  Write-Host "Building renderer (first time, ~10s)..." -ForegroundColor Yellow
  Push-Location $ProjectDir
  try {
    & npx vite build
    if ($LASTEXITCODE -ne 0) { throw "vite build failed: $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
  Write-Host "Renderer build done." -ForegroundColor Green
} else {
  Write-Host "Renderer already built, skipping." -ForegroundColor Green
}

# 3. Write VBScript silent launcher
$VbsPath    = Join-Path $ProjectDir "scripts\launch.vbs"
$VbsLine1   = "' sticky-note silent launcher (no console window)"
$VbsLine2   = "Set WshShell = CreateObject(" + [char]34 + "WScript.Shell" + [char]34 + ")"
$VbsLine3   = "WshShell.Run " + [char]34 + [char]34 + [char]34 + $ElectronExe + [char]34 + [char]34 + " " + [char]34 + [char]34 + $ProjectDir + [char]34 + [char]34 + " --start-ball" + [char]34 + ", 0, False"
$VbsContent = $VbsLine1 + "`r`n" + $VbsLine2 + "`r`n" + $VbsLine3
Set-Content -Path $VbsPath -Value $VbsContent -Encoding ASCII
Write-Host "VBScript launcher: $VbsPath" -ForegroundColor Green

# 4. Create desktop shortcut
$DesktopPath  = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath ([char]0x968f + [char]0x5fc3 + [char]0x8bb0 + ".lnk")
$Shell        = New-Object -ComObject WScript.Shell
$Shortcut     = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath       = "wscript.exe"
$Shortcut.Arguments        = [char]34 + $VbsPath + [char]34
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.Description      = "sticky-note"
$IcoPath = Join-Path $ProjectDir "assets\icon.ico"
$Shortcut.IconLocation     = if (Test-Path $IcoPath) { $IcoPath + ",0" } else { $ElectronExe + ",0" }
$Shortcut.Save()
Write-Host "Desktop shortcut: $ShortcutPath" -ForegroundColor Green

# 5. Register auto-start (current user registry)
$RegPath  = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$RegName  = [char]0x968f + [char]0x5fc3 + [char]0x8bb0
$RegValue = "wscript.exe " + [char]34 + $VbsPath + [char]34
Set-ItemProperty -Path $RegPath -Name $RegName -Value $RegValue
Write-Host "Auto-start registered." -ForegroundColor Green

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Cyan
Write-Host "Desktop: $ShortcutPath"
Write-Host "Auto-start: registered (ball mode on boot)"
