import * as THREE from 'three'

export const createScene = () => {
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xfff4ea, 0x2a2d36, 1.7))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(1.2, 2, 1.6)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xffb27a, 0.9)
  rim.position.set(-1.5, 0.6, -1.2)
  scene.add(rim)
  return scene
}

export const VIEWS = {
  iso: [1, 0.85, 1.15],
  front: [0, 0.0001, 1],
  side: [1, 0.0001, 0],
  top: [0, 1, 0.0001],
} as const
export type ViewName = keyof typeof VIEWS

// Boîte englobante des seuls maillages visibles (un plateau Bambu masque les autres).
export const visibleBox = (object: THREE.Object3D): THREE.Box3 => {
  object.updateMatrixWorld(true)
  const box = new THREE.Box3()
  object.traverseVisible((child) => {
    // Lignes comprises : un G-code n'est fait que de segments.
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      box.expandByObject(child)
    }
  })
  return box
}

// Place la caméra pour que tout l'objet tienne dans le cadre, quel que soit le format.
export const frameObject = (
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  view: ViewName = 'iso',
  target?: THREE.Vector3,
) => {
  const sphere = visibleBox(object).getBoundingSphere(new THREE.Sphere())
  const radius = sphere.radius || 1
  const fov = THREE.MathUtils.degToRad(
    Math.min(camera.fov, camera.fov * camera.aspect),
  )
  const distance = (radius / Math.sin(fov / 2)) * 1.08
  camera.near = distance / 100
  camera.far = distance * 100
  camera.position
    .copy(sphere.center)
    .add(new THREE.Vector3(...VIEWS[view]).normalize().multiplyScalar(distance))
  camera.lookAt(sphere.center)
  camera.updateProjectionMatrix()
  target?.copy(sphere.center)
  return sphere
}
