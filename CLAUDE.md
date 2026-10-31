# CLAUDE.md

Printshelf : bibliothèque locale de modèles 3D (3MF, STL, OBJ, PLY, GLB, ZIP). Application de bureau
(Node + navigateur) installée sur chaque ordinateur ; métadonnées synchronisées via un dossier cloud.
Vue d'ensemble et démarrage : `README.md` (en français, comme l'app).

| Dossier | Guide |
| --- | --- |
| `back/` | `back/CLAUDE.md` — API Fastify, SQLite, scan, synchro |
| `front/` | `front/CLAUDE.md` — React, TanStack, three.js |
| `deploy/` | Installation serveur optionnelle (Compose + Traefik, Dokploy) |
| `docs/` | Notes de conception (`synchronisation.md`) |

Vérifier avant de conclure, dans chaque app touchée : `npm run build` (typecheck), `npm run lint`
(zéro erreur, zéro avertissement), `npm test`.
