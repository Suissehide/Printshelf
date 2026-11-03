#!/bin/sh
# Crée Printshelf.app (icône Printshelf) dans ~/Applications, à glisser dans le Dock. À lancer une fois
# (double-clic). Propose aussi de lancer Printshelf à l'ouverture de session, en arrière-plan.
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"
APP="$HOME/Applications/Printshelf.app"
AGENT="$HOME/Library/LaunchAgents/app.printshelf.plist"

# * L'application : ouvre Printshelf s'il tourne déjà et est à jour, sinon le (re)démarre dans un Terminal.
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp macos/printshelf.icns "$APP/Contents/Resources/printshelf.icns"
cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Printshelf</string>
  <key>CFBundleDisplayName</key><string>Printshelf</string>
  <key>CFBundleIdentifier</key><string>app.printshelf.launcher</string>
  <key>CFBundleExecutable</key><string>Printshelf</string>
  <key>CFBundleIconFile</key><string>printshelf</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
</dict>
</plist>
EOF
# Tout passe par start.command (--app) : l'app suit ses évolutions sans avoir à être recréée.
cat > "$APP/Contents/MacOS/Printshelf" <<EOF
#!/bin/sh
exec /bin/sh "$ROOT/start.command" --app
EOF
chmod +x "$APP/Contents/MacOS/Printshelf"
touch "$APP" # rafraîchit l'icône dans le Finder
echo "Printshelf.app créée dans ~/Applications : glissez-la dans le Dock."
open -R "$APP"

# * Lancement à l'ouverture de session (LaunchAgent, sans fenêtre ni navigateur).
printf "Lancer Printshelf à l'ouverture de session ? (o/N) "
read -r answer
launchctl bootout "gui/$(id -u)" "$AGENT" 2>/dev/null
case "$answer" in
  [oOyY]*)
    mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
    # launchd ne lit pas le PATH du terminal : on y met le dossier de node tel qu'il est trouvé ici.
    NODE_DIR="$(dirname "$(command -v node)")"
    cat > "$AGENT" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>app.printshelf</string>
  <key>ProgramArguments</key>
  <array><string>/bin/sh</string><string>$ROOT/start.command</string><string>--demarrage</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$NODE_DIR:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/Printshelf.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/Printshelf.log</string>
</dict>
</plist>
EOF
    launchctl bootstrap "gui/$(id -u)" "$AGENT"
    echo "Printshelf démarrera à chaque ouverture de session (journal : ~/Library/Logs/Printshelf.log)."
    ;;
  *)
    rm -f "$AGENT"
    echo "Pas de lancement automatique."
    ;;
esac
