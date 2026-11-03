import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

// Tout ce qui parle au système d'exploitation : sélecteur de dossier natif, Finder/Explorateur,
// slicers installés. `execFile`/`spawn` uniquement (jamais un shell) : un nom de fichier contenant
// `&` ou `;` reste un argument, pas une commande.

export type Slicer = { id: string; name: string; executable: string }

const run = (command: string, args: string[]): Promise<string> =>
  new Promise((resolve) => {
    execFile(command, args, (error, stdout) =>
      resolve(error ? '' : stdout.trim()),
    )
  })

const launch = (command: string, args: string[]): void => {
  spawn(command, args, { detached: true, stdio: 'ignore' }).unref()
}

export const pickFolder = (): Promise<string> => {
  if (process.platform === 'darwin') {
    return run('osascript', [
      '-e',
      'POSIX path of (choose folder with prompt "Choisir un dossier de modèles 3D")',
    ])
  }
  if (process.platform === 'win32') {
    return run('powershell', [
      '-NoProfile',
      '-STA',
      '-Command',
      "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath }",
    ])
  }
  return run('zenity', ['--file-selection', '--directory'])
}

export const reveal = (filePath: string): void => {
  if (process.platform === 'darwin') {
    launch('open', ['-R', filePath])
  } else if (process.platform === 'win32') {
    launch('explorer', [`/select,${filePath}`])
  } else {
    launch('xdg-open', [path.dirname(filePath)])
  }
}

// Plusieurs fichiers en UN appel : Bambu Studio, OrcaSlicer, PrusaSlicer et Cura les chargent
// alors ensemble, sur le même plateau.
export const openWith = (filePaths: string[], slicer?: Slicer): void => {
  if (slicer) {
    if (process.platform === 'darwin') {
      launch('open', ['-a', slicer.executable, ...filePaths])
    } else {
      launch(slicer.executable, filePaths)
    }
  } else if (process.platform === 'darwin') {
    launch('open', filePaths)
  } else {
    // Explorateur Windows / xdg-open : un fichier par appel.
    for (const filePath of filePaths) {
      launch(process.platform === 'win32' ? 'explorer' : 'xdg-open', [filePath])
    }
  }
}

// Nom affiché → motif reconnu sur le nom de l'application (.app sur Mac, .exe sur Windows).
const KNOWN_SLICERS: [string, RegExp][] = [
  ['Bambu Studio', /^bambu[- ]?studio/i],
  ['OrcaSlicer', /^orca[- ]?slicer/i],
  ['PrusaSlicer', /^prusa[- ]?slicer/i],
  ['UltiMaker Cura', /^(ultimaker[- ])?cura/i],
  ['Creality Print', /^creality[- ]?print/i],
  ['Anycubic Slicer Next', /^anycubic[- ]?slicer/i],
  ['Snapmaker Orca', /^snapmaker[- ]?orca/i],
  ['SuperSlicer', /^super[- ]?slicer/i],
  ['ElegooSlicer', /^elegoo[- ]?slicer/i],
  ['Lychee Slicer', /^lychee/i],
  ['CHITUBOX', /^chitubox/i],
  ['ideaMaker', /^idea[- ]?maker/i],
  ['FlashPrint', /^flash[- ]?print/i],
]

const listDir = async (dir: string): Promise<string[]> => {
  try {
    return await fs.readdir(dir)
  } catch {
    return []
  }
}

const findApps = async (
  dir: string,
  isApp: (name: string) => boolean,
  depth: number,
): Promise<string[]> => {
  const found: string[] = []
  for (const name of await listDir(dir)) {
    const full = path.join(dir, name)
    if (isApp(name)) {
      found.push(full)
    } else if (depth > 0) {
      found.push(...(await findApps(full, isApp, depth - 1)))
    }
  }
  return found
}

// ponytail: recherche à faible profondeur sous les dossiers d'installation usuels ; un slicer
// installé ailleurs n'est pas trouvé (l'ouverture avec l'application par défaut reste possible).
const candidateApps = async (): Promise<string[]> => {
  if (process.platform === 'darwin') {
    const roots = [
      '/Applications',
      path.join(process.env.HOME ?? '', 'Applications'),
    ]
    const lists = await Promise.all(
      roots.map((r) => findApps(r, (n) => n.endsWith('.app'), 1)),
    )
    return lists.flat()
  }
  if (process.platform === 'win32') {
    const { ProgramFiles, LOCALAPPDATA } = process.env
    const roots = [
      ProgramFiles,
      process.env['ProgramFiles(x86)'],
      LOCALAPPDATA && path.join(LOCALAPPDATA, 'Programs'),
    ]
    const lists = await Promise.all(
      roots
        .filter((r): r is string => !!r)
        .map((r) => findApps(r, (n) => n.toLowerCase().endsWith('.exe'), 2)),
    )
    return lists.flat()
  }
  return []
}

export const detectSlicers = async (): Promise<Slicer[]> => {
  const apps = await candidateApps()
  const slicers: Slicer[] = []
  for (const [name, pattern] of KNOWN_SLICERS) {
    const executable = apps.find((a) => pattern.test(path.basename(a)))
    if (executable) {
      slicers.push({
        id: name.toLowerCase().replaceAll(' ', '-'),
        name,
        executable,
      })
    }
  }
  return slicers
}
