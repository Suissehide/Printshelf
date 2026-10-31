import * as THREE from 'three'

import { LibraryApi } from '../../api/library.api.ts'
import { createModelMaterial, loadModel } from './load-model.ts'
import { createScene, frameObject } from './stage.ts'

// Miniatures des modèles qui n'en embarquent pas : rendues une par une dans un canevas
// hors écran, envoyées au back (cache disque), puis affichées. Un seul contexte WebGL pour
// toute l'application : les navigateurs en limitent le nombre.

const SIZE = 384
let renderer: THREE.WebGLRenderer | undefined
const material = createModelMaterial()
type Job = {
  path: string
  ext: string
  resolvers: ((url: string | null) => void)[]
}
const pending = new Map<string, Job>()
let running = false

const getRenderer = () => {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    renderer.setSize(SIZE, SIZE)
    renderer.outputColorSpace = THREE.SRGBColorSpace
  }
  return renderer
}

const render = async (
  hash: string,
  path: string,
  ext: string,
): Promise<string | null> => {
  try {
    const { object } = await loadModel(path, ext, material)
    const scene = createScene()
    scene.add(object)
    const camera = new THREE.PerspectiveCamera(30, 1)
    frameObject(camera, object)
    const r = getRenderer()
    r.render(scene, camera)
    const blob = await new Promise<Blob | null>((resolve) =>
      r.domElement.toBlob(resolve, 'image/png'),
    )
    if (!blob) {
      return null
    }
    await LibraryApi.putThumbnail(hash, blob).catch(() => undefined)
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

const pump = async () => {
  if (running) {
    return
  }
  running = true
  while (pending.size) {
    const [hash, job] = pending.entries().next().value as [string, Job]
    const url = await render(hash, job.path, job.ext)
    pending.delete(hash)
    for (const resolve of job.resolvers) {
      resolve(url)
    }
  }
  running = false
}

// Plusieurs copies d'un même contenu (même hash) partagent un seul rendu.
export const requestThumbnail = (
  hash: string,
  path: string,
  ext: string,
): Promise<string | null> =>
  new Promise((resolve) => {
    const job = pending.get(hash)
    if (job) {
      job.resolvers.push(resolve)
    } else {
      pending.set(hash, { path, ext, resolvers: [resolve] })
      void pump()
    }
  })
