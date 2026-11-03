@echo off
rem Cree le raccourci "Printshelf" sur le Bureau (icone Printshelf, fenetre reduite) et propose le
rem lancement au demarrage de Windows. A lancer une fois (ou de nouveau pour changer d'avis).
rem Il passe par cmd.exe pour pouvoir aussi etre epingle a la barre des taches ou au menu Demarrer.
cd /d "%~dp0.."
set "ROOT=%CD%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Printshelf.lnk');" ^
  "$s.TargetPath = $env:ComSpec;" ^
  "$s.Arguments = '/c start.bat';" ^
  "$s.WorkingDirectory = $env:ROOT;" ^
  "$s.IconLocation = $env:ROOT + '\windows\printshelf.ico';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = 'Printshelf - bibliotheque de modeles 3D';" ^
  "$s.Save()" || (pause & exit /b 1)
echo Raccourci "Printshelf" cree sur le Bureau.

rem Lancement a l'ouverture de session : meme raccourci dans le dossier Demarrage, sans navigateur.
choice /c ON /m "Lancer Printshelf au demarrage de Windows"
set "STARTUP_CHOICE=%ERRORLEVEL%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$lnk = [Environment]::GetFolderPath('Startup') + '\Printshelf.lnk';" ^
  "if ($env:STARTUP_CHOICE -ne '1') { Remove-Item $lnk -ErrorAction SilentlyContinue; exit }" ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk);" ^
  "$s.TargetPath = $env:ComSpec;" ^
  "$s.Arguments = '/c start.bat --demarrage';" ^
  "$s.WorkingDirectory = $env:ROOT;" ^
  "$s.IconLocation = $env:ROOT + '\windows\printshelf.ico';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Save()"
if "%STARTUP_CHOICE%"=="1" (echo Printshelf demarrera avec Windows.) else (echo Pas de lancement automatique.)
pause
