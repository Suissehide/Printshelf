@echo off
rem Cree le raccourci "Printshelf" sur le Bureau (icone Printshelf, fenetre reduite). A lancer une fois.
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
pause
