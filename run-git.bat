@echo off
cd /d "C:\Users\user\Documents\test"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
rem commits ya hechos — solo push

"C:\Program Files\Git\cmd\git.exe" push origin main
if %errorlevel%==0 (echo [OK] Push exitoso!) else (echo [ERROR] Push fallo)
pause
