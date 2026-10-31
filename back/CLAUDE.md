# CLAUDE.md — back

API Node/Fastify de Printshelf. TypeScript exécuté directement par `tsx` (pas de transpilation) ; Node 24+
requis pour `node:sqlite`.

## Commandes

- `npm run dev` — watch, port 4747, données dans `back/data/` (`DATA_DIR` pour changer).
- `npm start` — même chose sans watch ; sert aussi `front/dist` s'il existe (usage normal).
- `npm run build` — typecheck seulement (`tsc --noEmit`), tests compris.
- `npm run lint` — Biome. `npm test` — Vitest (`src/test/`).

## Architecture (`src/main/`)

```
index.ts                       # démarrage : conteneur → serveur HTTP → synchro → premier scan
application/config.ts          # variables d'environnement validées par Zod
application/container.ts       # SEUL point d'assemblage (équivalent du conteneur Awilix de MediSync)
domain/library.domain.ts       # sources, scan en arrière-plan + surveillance, contenu, miniatures,
                               # fichiers joints, infos d'impression, miniatures de plateau
domain/organizer.domain.ts     # tags/notes/favoris, envois au slicer, collections, file d'impression,
                               # préférences synchronisées (imprimantes, règles de slicer)
domain/sync.domain.ts          # synchro entre machines (voir docs/synchronisation.md)
infra/db/sqlite-client.ts      # schéma SQLite (tables locales vs synchronisées)
infra/repositories/            # FileRepository (local : sources, index, dimensions, réglages),
                               # SyncedRepository (5 tables synchronisées)
infra/fs/zip-reader.ts         # lecteur ZIP sans dépendance (3MF et archives), lecture par plage
infra/fs/model-files.ts        # parcours, hash, lecture (y compris dans une archive), miniature 3MF
infra/fs/print-info.ts         # réglages de slicer d'un 3MF (Bambu/Orca/Prusa) : plateaux, filaments, durée
infra/fs/dimensions.ts         # mesure X×Y×Z d'un STL/3MF/OBJ/PLY, sans moteur 3D
infra/fs/companions.ts         # images/PDF/readme voisins d'un modèle (disque ou archive)
infra/system/desktop.ts        # sélecteur de dossier natif, Finder/Explorateur, slicers installés
interfaces/http/fastify/       # serveur, garde-fous (plugins/guard.plugin.ts), routes, schémas Zod
```

## Invariants

- **Métadonnées = hash du contenu**, jamais le chemin (elles suivent un fichier renommé et passent
  d'une machine à l'autre). Les chemins n'existent que dans les tables locales `source`/`file`.
- **Toute écriture synchronisée passe par `SyncedRepository`** : c'est lui qui horodate, pose les pierres
  tombales et déclenche l'export. Une écriture SQL directe dans ces tables ne serait jamais synchronisée.
- **Schéma** : `CREATE TABLE IF NOT EXISTS` + `ADDED_COLUMNS` (`sqlite-client.ts`) pour toute colonne
  ajoutée à une base existante. Une colonne ajoutée à une table synchronisée doit être nullable : les
  fichiers de synchro d'une version plus ancienne ne la portent pas.
- **Les fichiers des sources ne sont jamais modifiés.** Une entrée d'archive à ouvrir dans un slicer est
  extraite dans `DATA_DIR/extracted/`.
- **Fichiers joints : seul un nom de la liste calculée est servi** (`readCompanion`), jamais un chemin
  reçu tel quel ; la recherche ne sort jamais de la source ni de l'archive. SVG exclu (script possible).
- **Garde-fous HTTP** (`guard.plugin.ts`) : hôte autorisé (anti DNS-rebinding), écritures en JSON/PNG
  uniquement (anti-CSRF), HTTP Basic dès que `AUTH_PASSWORD` est défini — obligatoire si `HOST` n'est pas
  local (`config.ts` refuse de démarrer sinon). Commandes système via `execFile`/`spawn`, jamais un shell.
- **Mode serveur** (`DESKTOP=false`, dans Docker) : routes `/api/system/{pick-folder,slicers,open,reveal}`
  en 501, sources limitées à `SOURCES_ROOT`.
