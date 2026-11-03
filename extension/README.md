# Extension « Enregistrer dans Printshelf »

Téléchargez un modèle sur **Printables, MakerWorld, Thingiverse, Cults3D ou MyMiniFactory** : une fois le
téléchargement terminé, l'extension prévient Printshelf, qui **copie** le fichier (l'original reste dans vos
téléchargements) dans son dossier d'import, avec :

- l'**image** de la page (`couverture.jpg`, visible dans les fichiers joints) ;
- un **`LISEZMOI.txt`** : titre, créateur, lien de la page, description ;
- le **créateur** et le **lien d'origine** renseignés dans la fiche du modèle (sans écraser ce que vous avez
  déjà saisi), synchronisés entre vos ordinateurs.

Les archives (ZIP, RAR, 7z) sont importées telles quelles : chaque modèle qu'elles contiennent reçoit créateur et lien.

## Installer

- **Chrome, Edge, Brave** : `chrome://extensions` → activer le *mode développeur* → *Charger l'extension non
  empaquetée* → choisir ce dossier `extension/`.
- **Firefox** (121+) ne gère pas encore les service workers d'extension : il a son propre manifeste,
  `manifest.firefox.json`. Préparez une copie depuis ce dossier :

  ```bash
  rm -rf ../extension-firefox && cp -R . ../extension-firefox && mv ../extension-firefox/manifest.firefox.json ../extension-firefox/manifest.json
  ```

  puis `about:debugging` → *Ce Firefox* → *Charger un module temporaire* → `extension-firefox/manifest.json`.

Printshelf doit être lancé (http://localhost:4747 par défaut, modifiable dans la fenêtre de l'extension).
Le dossier d'import se règle dans **Printshelf → Réglages → Extension de navigateur** ; par défaut,
« Importés Printshelf » dans votre première source.

## Comment c'est fait

- `background.js` : à la création d'un téléchargement depuis un site reconnu, lit la page d'origine ; à la fin
  du téléchargement (modèle `.3mf`, `.stl`, `.obj`, `.ply`, `.glb`, `.step`, `.gcode`, ou archive `.zip`, `.rar`, `.7z`), appelle `POST /api/imports`.
- `page-info.js` : lecture de la page **uniquement par des données standard** (Open Graph, JSON-LD, balise
  `author`, titre « Nom by Créateur ») — aucun sélecteur propre à un site, donc rien ne casse quand un site
  change sa mise en page ; au pire, le créateur reste à compléter dans Printshelf.
- Permissions : `downloads` (voir les téléchargements terminés), `scripting` (lire la page du modèle, sur les
  seuls sites listés), `storage` (réglages et historique), et l'accès à Printshelf sur `localhost`.
  Rien n'est envoyé ailleurs qu'à votre Printshelf local.
