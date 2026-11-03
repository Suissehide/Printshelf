@echo off
rem Lanceur Windows : double-cliquer. Met a jour dependances et interface (utile apres un git pull),
rem puis ouvre Printshelf. Quelques secondes quand rien n'a change.
cd /d "%~dp0"
where node >nul 2>nul || (echo Installez Node.js 24 ou plus : https://nodejs.org & pause & exit /b 1)
call npm --prefix back install --no-audit --no-fund || (pause & exit /b 1)
call npm --prefix front install --no-audit --no-fund || (pause & exit /b 1)
call npm --prefix front run build || (echo Construction de l'interface impossible & pause & exit /b 1)
start "" http://localhost:4747
npm --prefix back start
