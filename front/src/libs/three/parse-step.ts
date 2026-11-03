import occtimportjs from 'occt-import-js'
import wasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url'
import * as THREE from 'three'

// STEP (pièces de CAO) : le B-rep est maillé dans le navigateur par OpenCascade compilé en
// WebAssembly (~7 Mo, chargé seulement au premier STEP ouvert). Résultat en mm, Z-haut.

type OcctMesh = {
  attributes: {
    position: { array: number[] }
    normal?: { array: number[] }
  }
  index: { array: number[] }
}
type Occt = {
  ReadStepFile: (
    content: Uint8Array,
    params: null,
  ) => { success: boolean; meshes: OcctMesh[] }
}

let occt: Promise<Occt> | undefined

export const parseSTEP = async (
  buffer: ArrayBuffer,
  material: THREE.Material,
): Promise<THREE.Object3D> => {
  occt ??= occtimportjs({ locateFile: () => wasmUrl }) as Promise<Occt>
  const result = (await occt).ReadStepFile(new Uint8Array(buffer), null)
  if (!result.success) {
    throw new Error('Fichier STEP illisible')
  }
  const group = new THREE.Group()
  for (const mesh of result.meshes) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3),
    )
    geometry.setIndex(mesh.index.array)
    if (mesh.attributes.normal) {
      geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3),
      )
    } else {
      geometry.computeVertexNormals()
    }
    group.add(new THREE.Mesh(geometry, material))
  }
  return group
}
