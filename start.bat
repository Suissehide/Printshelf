@echo off
rem Lanceur Windows : double-cliquer. Installe au premier lancement, puis ouvre Printshelf.
cd /d "%~dp0"
where node >nul 2>nul || (echo Installez Node.js 24 ou plus : https://nodejs.org & pause & exit /b 1)
if not exist back\node_modules call npm --prefix back install
if not exist front\node_modules call npm --prefix front install
if not exist front\dist call npm --prefix front run build
start "" http://localhost:4747
npm --prefix back start
