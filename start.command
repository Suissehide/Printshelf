#!/bin/sh
# Lanceur macOS : double-cliquer. Installe au premier lancement, puis ouvre Printshelf.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Installez Node.js 24 ou plus : https://nodejs.org"; read -r _; exit 1; }
[ -d back/node_modules ] || npm --prefix back install
[ -d front/node_modules ] || npm --prefix front install
[ -d front/dist ] || npm --prefix front run build
(sleep 2; open http://localhost:4747) &
npm --prefix back start
