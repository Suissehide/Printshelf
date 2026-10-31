import { Camera, Grid3x3, Loader2, Rotate3d, Shapes } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import {
  createModelMaterial,
  type LoadedModel,
  loadModel,
} from '@/libs/three/load-model.ts'
import { applyFilamentColors, showPlate } from '@/libs/three/slicer-layout.ts'
import {
  createScene,
  frameObject,
  type ViewName,
  visibleBox,
} from '@/libs/three/stage.ts'
import type { PrintInfo } from '@/types/library.ts'
import { cn } from '@/utils/cn.ts'

const VIEW_LABELS: [ViewName, string][] = [
  ['iso', 'Iso'],
  ['front', 'Face'],
  ['side', 'Côté'],
  ['top', 'Dessus'],
]
const COLORS = [
  '#d9d6d0',
  '#ff8a3d',
  '#60a5fa',
  '#4ade80',
  '#f472b6',
  '#2a2b30',
]

type Stage = {
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  scene: THREE.Scene
  grid: THREE.GridHelper
  material: THREE.MeshStandardMaterial
  object?: THREE.Object3D
  colored?: boolean
}

// Plateau d'impression sous les objets visibles, à leur échelle.
const placeGrid = (stage: Stage) => {
  if (!stage.object) {
    return
  }
  const box = visibleBox(stage.object)
  const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 1.6 || 1
  stage.grid.scale.setScalar(span)
  stage.grid.position.set(
    (box.min.x + box.max.x) / 2,
    box.min.y,
    (box.min.z + box.max.z) / 2,
  )
}

type ToolProps = {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}
const Tool = ({ label, active, onClick, children }: ToolProps) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      'grid size-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-overlay hover:text-ink [&_svg]:size-4',
      active &&
        'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent',
    )}
  >
    {children}
  </button>
)

// Visionneuse : rotation (glisser), déplacement (clic droit), zoom (molette), vues prédéfinies,
// rotation automatique, filaire, plateau, couleur et capture PNG. Avec `printInfo` (3MF de
// slicer) : couleurs de filament du projet et affichage plateau par plateau (`plate`).
export const ModelViewer = ({
  path,
  ext,
  name,
  printInfo,
  plate = null,
  onLoaded,
}: {
  path: string
  ext: string
  name: string
  printInfo?: PrintInfo
  plate?: number | null
  onLoaded?: (model: LoadedModel) => void
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<Stage | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [view, setView] = useState<ViewName>('iso')
  const [autoRotate, setAutoRotate] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [color, setColor] = useState(COLORS[0])
  const onLoadedRef = useRef(onLoaded)
  onLoadedRef.current = onLoaded

  // Scène créée une fois par modèle, libérée au démontage.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    const scene = createScene()
    scene.background = new THREE.Color('#141519')
    const camera = new THREE.PerspectiveCamera(35, 1)
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.autoRotateSpeed = 1.6
    const grid = new THREE.GridHelper(1, 20, 0x3a3d46, 0x24262c)
    scene.add(grid)
    const material = createModelMaterial()
    const stage: Stage = { renderer, camera, controls, scene, grid, material }
    stageRef.current = stage

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas
      renderer.setSize(w, h, false)
      camera.aspect = w / h || 1
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    renderer.setAnimationLoop(() => {
      controls.update()
      renderer.render(scene, camera)
    })

    let cancelled = false
    setStatus('loading')
    loadModel(path, ext, material)
      .then((loaded) => {
        if (cancelled) {
          return
        }
        scene.add(loaded.object)
        stage.object = loaded.object
        placeGrid(stage)
        frameObject(camera, loaded.object, 'iso', controls.target)
        setStatus('ready')
        onLoadedRef.current?.(loaded)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setStatus('error')
        }
      })

    return () => {
      cancelled = true
      observer.disconnect()
      renderer.setAnimationLoop(null)
      controls.dispose()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
        }
      })
      renderer.dispose()
      stageRef.current = null
    }
  }, [path, ext])

  // Couleurs du projet (une fois) et plateau choisi, puis recadrage sur ce qui est visible.
  useEffect(() => {
    const stage = stageRef.current
    if (status !== 'ready' || !stage?.object || !printInfo) {
      return
    }
    if (!stage.colored) {
      applyFilamentColors(stage.object, printInfo, stage.material)
      stage.colored = true
    }
    showPlate(stage.object, printInfo, plate)
    placeGrid(stage)
    frameObject(stage.camera, stage.object, 'iso', stage.controls.target)
    setView('iso')
  }, [status, printInfo, plate])

  useEffect(() => {
    const stage = stageRef.current
    if (stage && status === 'ready') {
      stage.controls.autoRotate = autoRotate
      stage.grid.visible = showGrid
      stage.material.color.set(color)
      stage.object?.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          ;(child.material as THREE.MeshStandardMaterial).wireframe = wireframe
        }
      })
    }
  }, [autoRotate, showGrid, wireframe, color, status])

  const applyView = (next: ViewName) => {
    setView(next)
    const stage = stageRef.current
    if (stage?.object) {
      frameObject(stage.camera, stage.object, next, stage.controls.target)
    }
  }

  const capture = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const link = document.createElement('a')
      link.download = `${name.replace(/\.[^.]+$/, '')}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
  }

  return (
    <div className="relative size-full overflow-hidden bg-[#141519]">
      <canvas ref={canvasRef} className="size-full touch-none" />

      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center text-ink-mute">
          <Loader2 className="size-7 animate-spin" />
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-danger">
          Impossible d'afficher ce modèle : {error}
        </div>
      )}

      <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-line bg-surface/90 p-1 backdrop-blur">
        {VIEW_LABELS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => applyView(key)}
            className={cn(
              'h-8 rounded-lg px-3 text-ink-soft hover:text-ink',
              view === key && 'bg-overlay text-ink',
            )}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        <Tool
          label="Rotation automatique"
          active={autoRotate}
          onClick={() => setAutoRotate(!autoRotate)}
        >
          <Rotate3d />
        </Tool>
        <Tool
          label="Filaire"
          active={wireframe}
          onClick={() => setWireframe(!wireframe)}
        >
          <Shapes />
        </Tool>
        <Tool
          label="Plateau"
          active={showGrid}
          onClick={() => setShowGrid(!showGrid)}
        >
          <Grid3x3 />
        </Tool>
        <Tool label="Capture PNG" onClick={capture}>
          <Camera />
        </Tool>
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-xl border border-line bg-surface/90 p-1.5 backdrop-blur">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Couleur ${c}`}
            onClick={() => setColor(c)}
            className={cn(
              'size-5 rounded-full border border-white/10',
              color === c &&
                'ring-2 ring-accent ring-offset-2 ring-offset-surface',
            )}
            style={{ background: c }}
          />
        ))}
      </div>
      <p className="absolute right-4 bottom-4 hidden text-xs text-ink-mute md:block">
        glisser : pivoter · clic droit : déplacer · molette : zoom
      </p>
    </div>
  )
}
