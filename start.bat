@echo off
title Printshelf
rem Lanceur Windows : double-cliquer. Met a jour dependances et interface (utile apres un git pull),
rem puis ouvre Printshelf. Quelques secondes quand rien n'a change.
cd /d "%~dp0"
where node >nul 2>nul || (echo Installez Node.js 24 ou plus : https://nodejs.org & pause & exit /b 1)
rem --demarrage : lance a l'ouverture de session (windows\creer-raccourci.bat), sans ouvrir le navigateur.
rem Deja lance : on ouvre juste la page.
curl -fsS -o nul http://localhost:4747/api/health 2>nul && (if /i not "%~1"=="--demarrage" start "" http://localhost:4747) && exit /b 0
call npm --prefix back install --no-audit --no-fund || (pause & exit /b 1)
call npm --prefix front install --no-audit --no-fund || (pause & exit /b 1)
call npm --prefix front run build || (echo Construction de l'interface impossible & pause & exit /b 1)
if /i not "%~1"=="--demarrage" start "" http://localhost:4747
npm --prefix back start
