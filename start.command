#!/bin/sh
# Lanceur macOS : double-cliquer. Met à jour dépendances et interface (utile après un git pull),
# puis ouvre Printshelf. Quelques secondes quand rien n'a changé.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Installez Node.js 24 ou plus : https://nodejs.org"; read -r _; exit 1; }
# --demarrage : lancé à l'ouverture de session (macos/creer-app.command), sans ouvrir le navigateur.
[ "$1" = "--demarrage" ] && SILENT=1
# Version du code (commit) avec laquelle le serveur en cours a démarré : écrite plus bas.
VERSION="$(git rev-parse HEAD 2>/dev/null)"
if curl -fsS -o /dev/null http://localhost:4747/api/health 2>/dev/null; then
  # Déjà lancé et à jour : on ouvre juste la page.
  if [ "$(cat .printshelf-version 2>/dev/null)" = "$VERSION" ]; then
    [ -n "$SILENT" ] || open http://localhost:4747
    exit 0
  fi
  # Lancé avant un git pull : on arrête l'ancien serveur pour repartir sur le nouveau code.
  [ "$1" = "--app" ] && { open -a Terminal "$0"; exit 0; }
  echo "Mise à jour détectée : redémarrage de Printshelf…"
  kill $(lsof -ti tcp:4747 -sTCP:LISTEN) 2>/dev/null
  sleep 1
fi
# Printshelf.app (--app) : construire et lancer se fait dans un Terminal, pour voir où ça en est.
[ "$1" = "--app" ] && { open -a Terminal "$0"; exit 0; }
npm --prefix back install --no-audit --no-fund || exit 1
npm --prefix front install --no-audit --no-fund || exit 1
npm --prefix front run build || { echo "Construction de l'interface impossible"; read -r _; exit 1; }
echo "$VERSION" > .printshelf-version
[ -n "$SILENT" ] || (sleep 2; open http://localhost:4747) &
npm --prefix back start
