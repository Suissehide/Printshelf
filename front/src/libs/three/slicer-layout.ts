import * as THREE from 'three'

import type { PrintInfo } from '../../types/library.ts'

// Applique au modèle chargé ce que le slicer a enregistré dans le 3MF :
// - la couleur du filament de chaque objet / pièce (extrudeur → couleur du projet) ;
// - le plateau affiché : les objets des autres plateaux sont masqués.
// Les objets restent ceux de `parse3MF` (`userData.objectId` sur chaque élément de construction,
// `userData.partId` sur chaque composant).

const materialFor = (
  cache: Map<string, THREE.Material>,
  base: THREE.MeshStandardMaterial,
  color: string,
) => {
  let material = cache.get(color)
  if (!material) {
    material = base.clone()
    ;(material as THREE.MeshStandardMaterial).color.set(color)
    cache.set(color, material)
  }
  return material
}

const paint = (object: THREE.Object3D, material: THREE.Material) =>
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = material
    }
  })

export const applyFilamentColors = (
  root: THREE.Object3D,
  info: PrintInfo,
  base: THREE.MeshStandardMaterial,
) => {
  if (!info.filaments.length) {
    return
  }
  const cache = new Map<string, THREE.Material>()
  const colorOf = (extruder: number) =>
    info.filaments[Math.max(0, extruder - 1)]?.color
  root.traverse((item) => {
    const object = info.objects.find((o) => o.id === item.userData.objectId)
    if (!object) {
      return
    }
    const objectColor = colorOf(object.extruder)
    if (objectColor) {
      paint(item, materialFor(cache, base, objectColor))
    }
    for (const part of item.children) {
      const extruder = object.parts.find(
        (p) => p.id === part.userData.partId,
      )?.extruder
      const partColor = extruder ? colorOf(extruder) : undefined
      if (partColor) {
        paint(part, materialFor(cache, base, partColor))
      }
    }
  })
}

// `plate` = index du plateau à montrer, ou null pour tout montrer.
export const showPlate = (
  root: THREE.Object3D,
  info: PrintInfo,
  plate: number | null,
) => {
  const ids =
    plate === null
      ? null
      : new Set(info.plates.find((p) => p.index === plate)?.objectIds ?? [])
  root.traverse((item) => {
    if (item.userData.objectId !== undefined) {
      item.visible = !ids || ids.has(item.userData.objectId)
    }
  })
}
