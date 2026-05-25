@echo off
cd /d "%~dp0"
echo === Adding files...
git add speakers/juan-camilo-silva.png speakers/camila.png index.html
echo === Committing...
git commit -m "feat: add Camila speaker card, footer TechnoLabs credit, speaker images"
echo === Pushing...
git push origin main
echo === Done! Press any key to close.
pause
