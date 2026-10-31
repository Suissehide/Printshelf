import * as THREE from 'three'
import { strFromU8, unzipSync } from 'three/examples/jsm/libs/fflate.module.js'

// Lecteur 3MF maison. Le 3MFLoader de three.js ne résout pas les composants rangés dans un
// autre fichier du paquet (`p:path`, extension « production »), or c'est la forme des projets
// Bambu Studio / OrcaSlicer : chaque objet vit dans `3D/Objects/object_N.model`.
// Couleurs : celles des `basematerials` (Prusa, exports génériques). Les couleurs peintes de
// Bambu ne sont pas lues — la miniature du slicer les montre déjà.

const PRODUCTION_NS =
  'http://schemas.microsoft.com/3dmanufacturing/production/2015/06'
const byTag = (el: Element | Document, name: string) => [
  ...el.getElementsByTagNameNS('*', name),
]
const productionPath = (el: Element) =>
  el.getAttributeNS(PRODUCTION_NS, 'path') || el.getAttribute('p:path')

export const parseTransform = (value: string | null): THREE.Matrix4 => {
  const m = new THREE.Matrix4()
  if (!value) {
    return m
  }
  const v = value.trim().split(/\s+/).map(Number)
  // 3MF : 12 valeurs, matrice 4x3 en lignes ; three.js attend la transposée.
  return m.set(
    v[0],
    v[3],
    v[6],
    v[9],
    v[1],
    v[4],
    v[7],
    v[10],
    v[2],
    v[5],
    v[8],
    v[11],
    0,
    0,
    0,
    1,
  )
}

const toColor = (hex: string | null) =>
  hex ? new THREE.Color(hex.slice(0, 7)) : null

export const parse3MF = (
  buffer: ArrayBuffer,
  fallback: THREE.Material,
): THREE.Group => {
  const zip = unzipSync(new Uint8Array(buffer))
  const docs = new Map<string, Document>()
  for (const name of Object.keys(zip)) {
    if (/\.model$/i.test(name)) {
      docs.set(
        `/${name}`,
        new DOMParser().parseFromString(
          strFromU8(zip[name]),
          'application/xml',
        ),
      )
    }
  }
  const main =
    [...docs.keys()].find((k) => /^\/3D\/3dmodel\.model$/i.test(k)) ??
    [...docs.keys()][0]
  if (!main) {
    throw new Error('Aucun modèle dans ce 3MF')
  }

  const geometries = new Map<string, THREE.BufferGeometry>()
  const materials = new Map<string, THREE.Material>()

  const materialFor = (
    doc: Document,
    file: string,
    obj: Element,
  ): THREE.Material => {
    const pid = obj.getAttribute('pid')
    if (!pid) {
      return fallback
    }
    const index = Number(obj.getAttribute('pindex') ?? 0)
    const key = `${file}#${pid}:${index}`
    if (!materials.has(key)) {
      const group = byTag(doc, 'basematerials').find(
        (b) => b.getAttribute('id') === pid,
      )
      const color = toColor(
        group
          ? (byTag(group, 'base')[index]?.getAttribute('displaycolor') ?? null)
          : null,
      )
      let material = fallback
      if (color) {
        material = (fallback as THREE.MeshStandardMaterial).clone()
        ;(material as THREE.MeshStandardMaterial).color = color
      }
      materials.set(key, material)
    }
    return materials.get(key) ?? fallback
  }

  const geometryOf = (key: string, mesh: Element) => {
    const cached = geometries.get(key)
    if (cached) {
      return cached
    }
    const vertices = byTag(mesh, 'vertex')
    const triangles = byTag(mesh, 'triangle')
    const position = new Float32Array(vertices.length * 3)
    const index = new Uint32Array(triangles.length * 3)
    vertices.forEach((v, i) => {
      position[i * 3] = Number(v.getAttribute('x'))
      position[i * 3 + 1] = Number(v.getAttribute('y'))
      position[i * 3 + 2] = Number(v.getAttribute('z'))
    })
    triangles.forEach((t, i) => {
      index[i * 3] = Number(t.getAttribute('v1'))
      index[i * 3 + 1] = Number(t.getAttribute('v2'))
      index[i * 3 + 2] = Number(t.getAttribute('v3'))
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
    geometry.setIndex(new THREE.BufferAttribute(index, 1))
    geometry.computeVertexNormals()
    geometries.set(key, geometry)
    return geometry
  }

  const build = (
    file: string,
    id: string | null,
    depth = 0,
  ): THREE.Object3D => {
    const doc = docs.get(file)
    const obj =
      doc && byTag(doc, 'object').find((o) => o.getAttribute('id') === id)
    if (!(doc && obj) || depth > 16) {
      return new THREE.Group()
    }
    const mesh = byTag(obj, 'mesh')[0]
    if (mesh) {
      return new THREE.Mesh(
        geometryOf(`${file}#${id}`, mesh),
        materialFor(doc, file, obj),
      )
    }
    const group = new THREE.Group()
    for (const component of byTag(obj, 'component')) {
      const child = build(
        productionPath(component) || file,
        component.getAttribute('objectid'),
        depth + 1,
      )
      child.applyMatrix4(parseTransform(component.getAttribute('transform')))
      // Bambu numérote les pièces (`<part id>` de model_settings.config) comme les composants.
      child.userData.partId = component.getAttribute('objectid')
      group.add(child)
    }
    return group
  }

  const root = new THREE.Group()
  const mainDoc = docs.get(main)
  for (const item of mainDoc ? byTag(mainDoc, 'item') : []) {
    const object = build(
      productionPath(item) || main,
      item.getAttribute('objectid'),
    )
    object.applyMatrix4(parseTransform(item.getAttribute('transform')))
    object.userData.objectId = item.getAttribute('objectid')
    root.add(object)
  }
  return root
}
