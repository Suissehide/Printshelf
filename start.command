#!/bin/sh
# Lanceur macOS : double-cliquer. Met à jour dépendances et interface (utile après un git pull),
# puis ouvre Printshelf. Quelques secondes quand rien n'a changé.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Installez Node.js 24 ou plus : https://nodejs.org"; read -r _; exit 1; }
npm --prefix back install --no-audit --no-fund || exit 1
npm --prefix front install --no-audit --no-fund || exit 1
npm --prefix front run build || { echo "Construction de l'interface impossible"; read -r _; exit 1; }
(sleep 2; open http://localhost:4747) &
npm --prefix back start
