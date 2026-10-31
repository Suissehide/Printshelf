import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const backRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
)

const list = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )

const configSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4747),
    // 127.0.0.1 en usage bureau ; 0.0.0.0 dans le conteneur (voir `deploy/`).
    HOST: z.string().default('127.0.0.1'),
    DATA_DIR: z.string().default(path.join(backRoot, 'data')),
    // Le front construit (`front/dist`) est servi par l'API en usage bureau : une seule adresse.
    FRONT_DIST: z.string().default(path.join(backRoot, '../front/dist')),
    // Mode bureau : sélecteur de dossier natif, ouverture dans le slicer, Finder/Explorateur.
    // Désactivé sur un serveur, où ces actions n'auraient aucun sens (elles s'exécuteraient
    // sur le serveur, pas devant l'utilisateur) : le front propose alors « Télécharger ».
    DESKTOP: z.stringbool().default(true),
    // Sur un serveur : seuls les dossiers sous cette racine peuvent devenir des sources
    // (le volume des modèles monté dans le conteneur), jamais le reste du système de fichiers.
    SOURCES_ROOT: z.string().optional(),
    // Noms d'hôte acceptés en plus de localhost (ex. `printshelf.example.com`).
    ALLOWED_HOSTS: list,
    AUTH_USER: z.string().default('printshelf'),
    AUTH_PASSWORD: z.string().default(''),
  })
  .refine(
    (c) =>
      ['127.0.0.1', 'localhost', '::1'].includes(c.HOST) ||
      c.AUTH_PASSWORD.length >= 12,
    {
      // Hors de la boucle locale, l'API donne accès à des fichiers : jamais sans mot de passe.
      message:
        'AUTH_PASSWORD (12 caractères minimum) est obligatoire dès que HOST n’est pas local',
      path: ['AUTH_PASSWORD'],
    },
  )

export type Config = z.infer<typeof configSchema>

export const config: Config = configSchema.parse(process.env)
