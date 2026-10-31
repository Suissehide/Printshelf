# Bibliothèque de démonstration

Les captures du README sont faites sur une bibliothèque **générée** (vases, engrenages, pièces d'échecs,
projet Bambu à deux plateaux, pack ZIP, doublons volontaires) : aucun modèle tiers, aucune donnée réelle.

Pour les refaire (Python 3 avec numpy, Google Chrome) :

```shell
python3 docs/demo/generer-demo.py "/tmp/demo/Impression 3D"
DATA_DIR=/tmp/demo/data npm --prefix back start          # dans un autre terminal
python3 docs/demo/remplir-demo.py "/tmp/demo/Impression 3D" /tmp/demo/cloud
```

Ouvrez une fois http://localhost:4747 (les miniatures se rendent dans le navigateur), puis capturez par
exemple avec Chrome headless :

```shell
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader \
  --enable-unsafe-swiftshader --hide-scrollbars --force-device-scale-factor=2 --window-size=1440,900 \
  --virtual-time-budget=10000 --screenshot=docs/images/bibliotheque.png http://localhost:4747/
```

N'utilisez pas la page Réglages telle quelle : elle affiche le nom réseau de l'ordinateur et des chemins locaux.
