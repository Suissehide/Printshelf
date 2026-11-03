# CLAUDE.md — front

SPA React 19 + Vite de Printshelf. Port **4271** en dev (`strictPort`), `/api` relayé vers le back (4747).

## Commandes

- `npm run dev` · `npm run build` (`tsc -b` puis `vite build`) · `npm run lint` (Biome, zéro avertissement)
  · `npm test` (Vitest).

## Structure (`src/`)

```
main.tsx                   # QueryClient + routeur
routeTree.gen.ts           # généré par TanStackRouterVite, ne pas éditer
routes/                    # __root (barre latérale), index (bibliothèque), modele, doublons, file, reglages
api/                       # appels HTTP, un fichier par domaine (http.ts : `request`, ApiError)
queries/                   # hooks TanStack Query (useLibrary, useOrganizer, useSystem)
components/{layout,library,viewer,ui}/
libs/library/              # logique pure testée : filtres, doublons (exacts, même géométrie, même nom),
                           # tags.ts (suggestions tirées du chemin), slicer.ts (choix du slicer, tient
                           # sur le plateau ?, imprimantes courantes)
libs/three/                # parse-3mf (composants p:path Bambu), parse-step (OpenCascade WASM, chargé à
                           # la demande), load-model (G-code compris), stage, thumbnail-queue,
                           # slicer-layout (couleurs de filament, plateau affiché)
components/model/          # panneaux de la fiche modèle : impression (plateaux), créateur et source,
                           # fichiers joints
hooks/useOpenInSlicer.ts   # SEUL chemin d'envoi au slicer (groupé par slicer cible, un appel chacun)
components/settings/       # panneaux de Réglages (slicers, imprimantes)
hooks/useToast.ts          # notifications (store minimal sur useSyncExternalStore)
styles/index.css           # jetons de design Tailwind 4 (@theme) : palette « atelier »
```

## Conventions

- Les **filtres de la bibliothèque vivent dans l'URL** (`validateLibrarySearch`) : lien et retour arrière
  retrouvent la même vue.
- `useModels()` joint l'index des fichiers aux métadonnées par **hash** ; ne jamais rattacher une donnée
  utilisateur au chemin.
- Un **seul contexte WebGL** pour toutes les miniatures (`thumbnail-queue.ts`), rendus en série et dédoublonnés
  par hash ; la visionneuse a le sien et le libère au démontage.
- `useCapabilities()` dit si l'on est dans l'app de bureau ou sur un serveur : en mode serveur, « Ouvrir dans
  le slicer » et « Afficher » deviennent « Télécharger ».
- `parse3MF` marque chaque élément de construction (`userData.objectId`) et chaque composant
  (`userData.partId`) : c'est le lien avec les infos d'impression lues par le back (`/api/files/print-info`).
- Couleurs : uniquement les jetons de `styles/index.css` (`bg-surface`, `text-ink-mute`, `text-accent`…).
