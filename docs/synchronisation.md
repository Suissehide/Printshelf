# Synchronisation entre ordinateurs

## Le besoin

Les fichiers de modèles existent sur chaque ordinateur (copies locales ou dossier cloud), à des chemins
différents. On veut retrouver partout ce que l'utilisateur a **ajouté** : tags, notes, favoris, collections,
file d'impression. On ne veut ni serveur à héberger, ni compte.

## Décision

Pas d'app en ligne : elle ne verrait pas les disques des ordinateurs, et ouvrir un modèle dans le slicer
local deviendrait impossible. À la place, chaque installation reste locale et **échange un fichier par
machine** dans un dossier que l'utilisateur synchronise déjà avec son cloud.

## Mécanique (`back/src/main/domain/sync.domain.ts`)

- **Clé = contenu.** Les données synchronisées sont rattachées au SHA-1 du fichier (`model_meta.id`,
  `collection_model.hash`, `queue_item.hash`), jamais au chemin. Un fichier renommé, déplacé, ou présent à un
  autre chemin sur l'autre machine garde ses tags.
- **Tables synchronisées** : `model_meta`, `collection`, `collection_model`, `queue_item`. Chaque ligne a un
  identifiant stable (UUID ou hash), `updated_at` (ms) et `deleted` (pierre tombale : une suppression se
  propage comme une modification).
- **Tables locales** : `source`, `file` (l'index), `setting` (dont `device_id`, `sync_folder`).
- **Écriture** : à chaque modification locale (`SyncedRepository.save/remove`), export différé d'1,5 s de
  toutes les lignes synchronisées vers `<dossier>/printshelf-sync/<deviceId>.json`, écrit de façon atomique
  (fichier temporaire puis renommage) pour que le client cloud ne propage jamais un fichier à moitié écrit.
- **Lecture** : au démarrage, toutes les 20 s et sur demande, lecture des fichiers **des autres** machines ;
  fusion ligne à ligne, la version au `updated_at` le plus grand gagne. Un fichier illisible (en cours de
  téléchargement par le client cloud) est ignoré et relu au passage suivant.
- **Front** : `GET /api/sync` expose une `revision` incrémentée à chaque import qui a changé quelque chose ;
  le front l'interroge toutes les 15 s et recharge tags/collections/file quand elle bouge.

## Limites connues

- Horodatage par l'horloge de chaque machine : deux modifications de la **même** ligne à quelques secondes
  d'intervalle sur deux machines aux horloges décalées peuvent s'ordonner à l'envers.
- Les pierres tombales ne sont jamais purgées (quelques octets par suppression).
- Les miniatures et l'index ne sont pas synchronisés : chaque machine les reconstruit au scan.

## Sauvegarde

`GET /api/sync/backup` produit le même format qu'un fichier de synchro ; `POST /api/sync/restore` le fusionne
avec la même règle (rien de plus récent n'est écrasé). Les lignes importées sont validées (Zod) et seules les
colonnes connues de chaque table sont écrites (`SyncedRepository`, liste blanche).
