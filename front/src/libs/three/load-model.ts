import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

import { LibraryApi } from '../../api/library.api.ts'
import { parse3MF } from './parse-3mf.ts'

export const createModelMaterial = (color = '#d9d6d0') =>
  // DoubleSide : beaucoup de fichiers téléchargés ont des faces mal orientées, qui disparaîtraient.
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide,
  })

const withMaterial = (object: THREE.Object3D, material: THREE.Material) => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = material
    }
  })
  return object
}

const meshFrom = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
  // Beaucoup de STL/PLY ont des normales nulles ou absentes : on les recalcule toujours.
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, material)
}

const parse = async (
  ext: string,
  buffer: ArrayBuffer,
  material: THREE.Material,
): Promise<THREE.Object3D> => {
  switch (ext) {
    case '3mf':
      return parse3MF(buffer, material)
    case 'stl':
      return meshFrom(new STLLoader().parse(buffer), material)
    case 'ply':
      return meshFrom(new PLYLoader().parse(buffer), material)
    case 'obj':
      return withMaterial(
        new OBJLoader().parse(new TextDecoder().decode(buffer)),
        material,
      )
    case 'glb': {
      // Le GLB garde ses propres matériaux et est en Y-haut : on annule la rotation Z-haut appliquée plus bas.
      const gltf = await new GLTFLoader().parseAsync(buffer, '')
      gltf.scene.rotation.x = Math.PI / 2
      return gltf.scene
    }
    default:
      throw new Error(`Format non pris en charge : .${ext}`)
  }
}

export type LoadedModel = {
  object: THREE.Group
  // Dimensions en unités du fichier (mm pour l'impression 3D) et nombre de triangles.
  size: THREE.Vector3
  triangles: number
}

export const loadModel = async (
  path: string,
  ext: string,
  material: THREE.Material,
): Promise<LoadedModel> => {
  const buffer = await LibraryApi.getContent(path)
  const inner = await parse(ext, buffer, material)
  // Les formats d'impression sont en Z-haut, three.js en Y-haut.
  const object = new THREE.Group()
  object.rotation.x = -Math.PI / 2
  object.add(inner)
  object.updateMatrixWorld(true)

  let triangles = 0
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const g = child.geometry as THREE.BufferGeometry
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3
    }
  })
  const size = new THREE.Box3()
    .setFromObject(object)
    .getSize(new THREE.Vector3())
  return { object, size, triangles }
}
