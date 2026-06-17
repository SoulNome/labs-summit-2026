@echo off
cd /d "C:\Users\user\Documents\test"

echo [1/4] Limpiando locks...
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul

echo [2/4] Agregando archivos...
"C:\Program Files\Git\cmd\git.exe" add -A

echo [3/4] Commiteando...
"C:\Program Files\Git\cmd\git.exe" commit -m "feat: add Melisa Parra + Cristobal Verasaluse speakers, Unmerco ally, connect all ticketera buttons, compress Mike photo"

echo [4/4] Pusheando a produccion...
"C:\Program Files\Git\cmd\git.exe" push origin main

if %errorlevel%==0 (
  echo.
  echo [OK] Todo subido a produccion!
) else (
  echo.
  echo [ERROR] Algo fallo - revisa arriba
)
pause
