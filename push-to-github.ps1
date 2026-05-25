Set-Location "C:\Users\user\Documents\test"
Write-Host "=== Adding files..." -ForegroundColor Cyan
& "C:\Program Files\Git\bin\git.exe" add "speakers\juan-camilo-silva.png" "speakers\camila.png" "index.html"
Write-Host "=== Committing..." -ForegroundColor Cyan
& "C:\Program Files\Git\bin\git.exe" commit -m "feat: add Camila speaker card, TechnoLabs footer, speaker images"
Write-Host "=== Pushing..." -ForegroundColor Cyan
& "C:\Program Files\Git\bin\git.exe" push origin main
Write-Host "=== Done!" -ForegroundColor Green
Read-Host "Press Enter to close"
