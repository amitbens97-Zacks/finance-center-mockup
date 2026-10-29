@echo off
rem Double-click to run the mockup locally. Close the "Mockup server" window to stop it.
cd /d "%~dp0"
start "Mockup server" /min python -m http.server 4181
timeout /t 2 /nobreak >nul
start "" "http://localhost:4181"
