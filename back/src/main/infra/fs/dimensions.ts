import { bufferSource, listEntries, readEntry } from './zip-reader.ts'

// Dimensions d'un modèle en mm (X largeur, Y profondeur, Z hauteur — repère d'impression), lues
// directement dans le fichier, sans moteur 3D. Sert à savoir s'il tient sur un plateau.
// Pour un 3MF, chaque objet posé est mesuré à part (rotation comprise, position ignorée) et on
// garde le plus grand sur chaque axe : un projet à plusieurs plateaux n'additionne pas ses objets.
// ponytail: max par axe sur des objets différents = estimation prudente (peut dire « trop grand »
// pour un projet dont aucun objet ne l'est seul) ; mesure par objet si ça gêne. GLB non mesuré.

export type Dimensions = { x: number; y: number; z: number }

class Box {
  min = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ]
  max = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]

  add(x: number, y: number, z: number) {
    const p = [x, y, z]
    for (let i = 0; i < 3; i++) {
      if (p[i] < this.min[i]) {
        this.min[i] = p[i]
      }
      if (p[i] > this.max[i]) {
        this.max[i] = p[i]
      }
    }
  }

  get empty() {
    return !(this.max[0] >= this.min[0])
  }

  corners(): number[][] {
    const out: number[][] = []
    for (const x of [this.min[0], this.max[0]]) {
      for (const y of [this.min[1], this.max[1]]) {
        for (const z of [this.min[2], this.max[2]]) {
          out.push([x, y, z])
        }
      }
    }
    return out
  }

  size(): Dimensions | null {
    if (this.empty) {
      return null
    }
    const round = (v: number) => Math.round(v * 100) / 100
    return {
      x: round(this.max[0] - this.min[0]),
      y: round(this.max[1] - this.min[1]),
      z: round(this.max[2] - this.min[2]),
    }
  }
}

const NUMBER_TRIPLE = String.raw`(-?[\d.]+(?:e[-+]?\d+)?)\s+(-?[\d.]+(?:e[-+]?\d+)?)\s+(-?[\d.]+(?:e[-+]?\d+)?)`

const boxFromText = (text: string, prefix: RegExp) => {
  const box = new Box()
  const pattern = new RegExp(`${prefix.source}${NUMBER_TRIPLE}`, 'gim')
  for (const m of text.matchAll(pattern)) {
    box.add(Number(m[1]), Number(m[2]), Number(m[3]))
  }
  return box.size()
}

const measureStl = (data: Buffer): Dimensions | null => {
  const count = data.length >= 84 ? data.readUInt32LE(80) : -1
  if (data.length === 84 + count * 50) {
    const box = new Box()
    for (let t = 0; t < count; t++) {
      for (let v = 0; v < 3; v++) {
        const o = 84 + t * 50 + 12 + v * 12
        box.add(
          data.readFloatLE(o),
          data.readFloatLE(o + 4),
          data.readFloatLE(o + 8),
        )
      }
    }
    return box.size()
  }
  return boxFromText(data.toString('latin1'), /^\s*vertex\s+/)
}

const PLY_SIZES: Record<string, number> = {
  char: 1,
  uchar: 1,
  int8: 1,
  uint8: 1,
  short: 2,
  ushort: 2,
  int16: 2,
  uint16: 2,
  int: 4,
  uint: 4,
  int32: 4,
  uint32: 4,
  float: 4,
  float32: 4,
  double: 8,
  float64: 8,
}

const measurePly = (data: Buffer): Dimensions | null => {
  const headerEnd = data.indexOf('end_header')
  if (headerEnd < 0) {
    return null
  }
  const header = data.toString('latin1', 0, headerEnd)
  const body = data.indexOf('\n', headerEnd) + 1
  const format = header.match(/^format\s+(\S+)/m)?.[1]
  // Hypothèse usuelle : l'élément `vertex` vient en premier.
  const vertexBlock = header.match(
    /element vertex (\d+)\n((?:property[^\n]*\n)*)/,
  )
  if (!vertexBlock) {
    return null
  }
  const count = Number(vertexBlock[1])
  const props = [...vertexBlock[2].matchAll(/property (\w+) (\w+)/g)].map(
    ([, type, name]) => ({ type, name }),
  )
  const axis = ['x', 'y', 'z'].map((n) => props.findIndex((p) => p.name === n))
  if (axis.some((i) => i < 0)) {
    return null
  }
  const box = new Box()
  if (format === 'ascii') {
    const lines = data.toString('latin1', body).split('\n')
    for (let i = 0; i < count && i < lines.length; i++) {
      const v = lines[i].trim().split(/\s+/).map(Number)
      box.add(v[axis[0]], v[axis[1]], v[axis[2]])
    }
    return box.size()
  }
  if (
    format !== 'binary_little_endian' ||
    props.some((p) => !PLY_SIZES[p.type])
  ) {
    return null
  }
  const offsets = props.map((_, i) =>
    props.slice(0, i).reduce((s, p) => s + PLY_SIZES[p.type], 0),
  )
  const stride = props.reduce((s, p) => s + PLY_SIZES[p.type], 0)
  const read = (o: number, type: string) =>
    PLY_SIZES[type] === 8 ? data.readDoubleLE(o) : data.readFloatLE(o)
  for (let i = 0; i < count; i++) {
    const base = body + i * stride
    if (base + stride > data.length) {
      break
    }
    const [x, y, z] = axis.map((a) => read(base + offsets[a], props[a].type))
    box.add(x, y, z)
  }
  return box.size()
}

// Matrice 3MF « m00 m01 m02 m10 … m32 » appliquée à un point (vecteur ligne).
const transform = (
  m: number[] | null,
  [x, y, z]: number[],
  translate = true,
) =>
  m
    ? [
        x * m[0] + y * m[3] + z * m[6] + (translate ? m[9] : 0),
        x * m[1] + y * m[4] + z * m[7] + (translate ? m[10] : 0),
        x * m[2] + y * m[5] + z * m[8] + (translate ? m[11] : 0),
      ]
    : [x, y, z]

const parseMatrix = (tag: string) => {
  const value = tag.match(/\btransform="([^"]*)"/)?.[1]
  const m = value?.trim().split(/\s+/).map(Number)
  return m?.length === 12 && m.every(Number.isFinite) ? m : null
}

const attr = (tag: string, name: string) =>
  tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]

// Boîte d'un ensemble de coins après transformation (avec ou sans translation).
const transformed = (box: Box, matrix: number[] | null, translate = true) => {
  const out = new Box()
  if (!box.empty) {
    for (const corner of box.corners()) {
      const [x, y, z] = transform(matrix, corner, translate)
      out.add(x, y, z)
    }
  }
  return out
}

const largestOf = (a: Dimensions | null, b: Dimensions | null) =>
  a && b
    ? { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), z: Math.max(a.z, b.z) }
    : (a ?? b)

const readModelDocs = async (data: Buffer) => {
  const source = bufferSource(data)
  const docs = new Map<string, string>()
  for (const entry of await listEntries(source)) {
    if (/\.model$/i.test(entry.name)) {
      docs.set(
        `/${entry.name}`,
        (await readEntry(source, entry)).toString('utf8'),
      )
    }
  }
  return docs
}

// Boîte de chaque objet (maillage + composants, y compris dans d'autres fichiers du paquet).
const objectBoxes = (docs: Map<string, string>) => {
  const objects = new Map<string, string>()
  for (const [file, xml] of docs) {
    for (const [object] of xml.matchAll(/<object\b[^>]*>[\s\S]*?<\/object>/g)) {
      objects.set(`${file}#${attr(object, 'id')}`, object)
    }
  }
  const boxes = new Map<string, Box>()
  const boxOf = (file: string, id: string | undefined, depth = 0): Box => {
    const key = `${file}#${id}`
    const xml = objects.get(key)
    if (boxes.has(key) || !xml || depth > 16) {
      return boxes.get(key) ?? new Box()
    }
    const box = new Box()
    for (const [v] of xml.matchAll(/<vertex\b[^>]*>/g)) {
      box.add(Number(attr(v, 'x')), Number(attr(v, 'y')), Number(attr(v, 'z')))
    }
    for (const [c] of xml.matchAll(/<component\b[^>]*>/g)) {
      const child = boxOf(
        attr(c, 'p:path') ?? file,
        attr(c, 'objectid'),
        depth + 1,
      )
      const placed = transformed(child, parseMatrix(c))
      if (!placed.empty) {
        box.add(placed.min[0], placed.min[1], placed.min[2])
        box.add(placed.max[0], placed.max[1], placed.max[2])
      }
    }
    boxes.set(key, box)
    return box
  }
  return boxOf
}

const measure3mf = async (data: Buffer): Promise<Dimensions | null> => {
  const docs = await readModelDocs(data)
  const main =
    [...docs.keys()].find((k) => /^\/3D\/3dmodel\.model$/i.test(k)) ??
    [...docs.keys()][0]
  if (!main) {
    return null
  }
  const boxOf = objectBoxes(docs)
  let largest: Dimensions | null = null
  for (const [item] of (docs.get(main) ?? '').matchAll(/<item\b[^>]*>/g)) {
    const object = boxOf(attr(item, 'p:path') ?? main, attr(item, 'objectid'))
    largest = largestOf(
      largest,
      transformed(object, parseMatrix(item), false).size(),
    )
  }
  return largest
}

export const measureModel = (
  ext: string,
  data: Buffer,
): Promise<Dimensions | null> | Dimensions | null => {
  switch (ext) {
    case 'stl':
      return measureStl(data)
    case 'obj':
      return boxFromText(data.toString('latin1'), /^v\s+/)
    case 'ply':
      return measurePly(data)
    case '3mf':
      return measure3mf(data)
    default:
      return null
  }
}

// Nombre de triangles. Avec les dimensions, c'est l'empreinte d'une géométrie : le même modèle
// exporté en STL et en 3MF a un contenu (hash) différent mais la même empreinte.
// ponytail: un 3MF compte chaque maillage une fois (copies posées non multipliées) ; suffisant pour
// le cas courant d'un objet seul.
export const countTriangles = async (
  ext: string,
  data: Buffer,
): Promise<number | null> => {
  const count = (text: string, pattern: RegExp) =>
    text.match(pattern)?.length ?? 0
  switch (ext) {
    case 'stl': {
      const binary = data.length >= 84 ? data.readUInt32LE(80) : -1
      if (data.length === 84 + binary * 50) {
        return binary
      }
      return count(data.toString('latin1'), /^\s*facet\b/gim) || null
    }
    case 'obj': {
      let triangles = 0
      for (const [, vertices] of data
        .toString('latin1')
        .matchAll(/^f\s+(.+)$/gm)) {
        triangles += Math.max(0, vertices.trim().split(/\s+/).length - 2)
      }
      return triangles || null
    }
    case 'ply': {
      const faces = data
        .toString('latin1', 0, Math.min(data.length, 4096))
        .match(/element face (\d+)/)
      return faces ? Number(faces[1]) : null
    }
    case '3mf': {
      let triangles = 0
      for (const xml of (await readModelDocs(data)).values()) {
        triangles += count(xml, /<triangle\b/g)
      }
      return triangles || null
    }
    default:
      return null
  }
}
