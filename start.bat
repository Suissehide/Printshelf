@echo off
title Printshelf
rem Lanceur Windows : double-cliquer. Met a jour dependances et interface (utile apres un git pull),
rem puis ouvre Printshelf. Quelques secondes quand rien n'a change.
cd /d "%~dp0"
where node >nul 2>nul || (echo Installez Node.js 24 ou plus : https://nodejs.org & pause & exit /b 1)
rem --demarrage : lance a l'ouverture de session (windows\creer-raccourci.bat), sans ouvrir le navigateur.
rem Version du code (commit) avec laquelle le serveur en cours a demarre : ecrite plus bas.
set "VERSION="
set "CURRENT="
for /f %%v in ('git rev-parse HEAD 2^>nul') do set "VERSION=%%v"
if exist .printshelf-version set /p CURRENT=<.printshelf-version
curl -fsS -o nul http://localhost:4747/api/health 2>nul || goto build
rem Deja lance et a jour : on ouvre juste la page.
if "%CURRENT%"=="%VERSION%" goto open
rem Lance avant un git pull : on arrete l'ancien serveur pour repartir sur le nouveau code.
echo Mise a jour detectee : redemarrage de Printshelf...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":4747" ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>nul
timeout /t 1 /nobreak >nul
:build
call npm --prefix back install --no-audit --no-fund || (pause & exit /b 1)
call npm --prefix front install --no-audit --no-fund || (pause & exit /b 1)
call npm --prefix front run build || (echo Construction de l'interface impossible & pause & exit /b 1)
> .printshelf-version echo(%VERSION%
if /i not "%~1"=="--demarrage" start "" http://localhost:4747
npm --prefix back start
exit /b

:open
if /i not "%~1"=="--demarrage" start "" http://localhost:4747
exit /b 0
