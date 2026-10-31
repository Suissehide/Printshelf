import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { PrintInfo } from '../../types/library.ts'
import { applyFilamentColors, showPlate } from './slicer-layout.ts'
import { visibleBox } from './stage.ts'

const cube = () => new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10))
const item = (objectId: string, x: number, partIds: string[]) => {
  const group = new THREE.Group()
  group.userData.objectId = objectId
  group.position.x = x
  for (const id of partIds) {
    const part = new THREE.Group()
    part.userData.partId = id
    part.add(cube())
    group.add(part)
  }
  return group
}

const info: PrintInfo = {
  slicer: 'bambu',
  printer: null,
  layerHeight: null,
  filaments: [
    { color: '#ffffff', type: 'PLA' },
    { color: '#ff6a13', type: 'PETG' },
  ],
  plates: [
    {
      index: 1,
      name: '',
      objectIds: ['2'],
      seconds: null,
      grams: null,
      filaments: [],
    },
    {
      index: 2,
      name: '',
      objectIds: ['4'],
      seconds: null,
      grams: null,
      filaments: [],
    },
  ],
  objects: [
    { id: '2', name: '', extruder: 1, parts: [{ id: '1', extruder: 0 }] },
    {
      id: '4',
      name: '',
      extruder: 1,
      parts: [
        { id: '3', extruder: 0 },
        { id: '5', extruder: 2 },
      ],
    },
  ],
}

const colorOf = (o: THREE.Object3D) =>
  (
    (o.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial
  ).color.getHexString()

describe('slicer-layout', () => {
  it('colore objets et pièces selon leur extrudeur', () => {
    const root = new THREE.Group().add(
      item('2', 0, ['1']),
      item('4', 300, ['3', '5']),
    )
    applyFilamentColors(root, info, new THREE.MeshStandardMaterial())
    const [cubeItem, tour] = root.children
    expect(colorOf(cubeItem.children[0])).toBe('ffffff')
    expect(colorOf(tour.children[0])).toBe('ffffff')
    expect(colorOf(tour.children[1])).toBe('ff6a13')
  })

  it('montre un seul plateau et recadre sur ses objets', () => {
    const root = new THREE.Group().add(
      item('2', 0, ['1']),
      item('4', 300, ['3', '5']),
    )
    showPlate(root, info, 2)
    expect(root.children.map((c) => c.visible)).toEqual([false, true])
    expect(visibleBox(root).getCenter(new THREE.Vector3()).x).toBe(300)
    showPlate(root, info, null)
    expect(root.children.every((c) => c.visible)).toBe(true)
  })
})
