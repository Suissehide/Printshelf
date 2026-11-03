#!/bin/sh
# Lanceur macOS : double-cliquer. Met à jour dépendances et interface (utile après un git pull),
# puis ouvre Printshelf. Quelques secondes quand rien n'a changé.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Installez Node.js 24 ou plus : https://nodejs.org"; read -r _; exit 1; }
# --demarrage : lancé à l'ouverture de session (macos/creer-app.command), sans ouvrir le navigateur.
[ "$1" = "--demarrage" ] && SILENT=1
# Déjà lancé (par l'ouverture de session ou une autre fenêtre) : on ouvre juste la page.
if curl -fsS -o /dev/null http://localhost:4747/api/health 2>/dev/null; then
  [ -n "$SILENT" ] || open http://localhost:4747
  exit 0
fi
npm --prefix back install --no-audit --no-fund || exit 1
npm --prefix front install --no-audit --no-fund || exit 1
npm --prefix front run build || { echo "Construction de l'interface impossible"; read -r _; exit 1; }
[ -n "$SILENT" ] || (sleep 2; open http://localhost:4747) &
npm --prefix back start
