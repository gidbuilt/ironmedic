import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three-stdlib'
import { GUS_3D_URL, GUS_ANIM_URLS } from '../../lib/gusAssets'

const IDLE_CLIP = 'preset:biped:idle'
const FOLD_CLIP = 'preset:biped:fold_arms'
const WALK_CLIP = 'preset:biped:walk'

const TARGET_HEIGHT = 1.85
const CAMERA_DISTANCE = 3.25

/** Camera sits on +X; larger stage X = closer to the lens. */
const STAGE_X_IDLE = 0.1
const STAGE_X_NEAR = 0.85

/** Yaw: 0 faces the camera (+X), π walks back into the shop. */
const FACE_CAM = 0
const FACE_AWAY = Math.PI
/** Slow pivot back to camera after the walk home. */
const TURN_BACK_SECONDS = 1.15
/** Fraction of the retreat walk spent easing the 180° turn (rest faces away). */
const RETREAT_TURN_BLEND = 0.48

type TalkPhase = 'idle' | 'approach' | 'talk' | 'agree' | 'retreat' | 'turn_back'

function CameraRig() {
  const { camera } = useThree()
  useLayoutEffect(() => {
    camera.position.set(CAMERA_DISTANCE, 1.7, 0.02)
    camera.lookAt(0, 1.2, 0)
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

function makeRadialTexture(stops: Array<[number, string]>, size = 256): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [t, c] of stops) g.addColorStop(t, c)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function FloorShadows() {
  const contact = useMemo(
    () =>
      makeRadialTexture([
        [0, 'rgba(0,0,0,0.88)'],
        [0.2, 'rgba(0,0,0,0.5)'],
        [0.5, 'rgba(0,0,0,0.16)'],
        [1, 'rgba(0,0,0,0)'],
      ]),
    [],
  )
  const cast = useMemo(
    () =>
      makeRadialTexture([
        [0, 'rgba(0,0,0,0.5)'],
        [0.35, 'rgba(0,0,0,0.2)'],
        [1, 'rgba(0,0,0,0)'],
      ]),
    [],
  )
  if (!contact || !cast) return null

  return (
    <group position={[0.12, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} renderOrder={5}>
        <planeGeometry args={[2.6, 1.6]} />
        <meshBasicMaterial map={contact} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0.7, 0.007, 0]}
        scale={[1.7, 0.7, 1]}
        renderOrder={5}
      >
        <planeGeometry args={[3.2, 1.8]} />
        <meshBasicMaterial map={cast} transparent depthWrite={false} opacity={0.9} toneMapped={false} />
      </mesh>
    </group>
  )
}

function applyStageMaterials(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return
    const mesh = obj as THREE.Mesh
    mesh.castShadow = false
    mesh.receiveShadow = false
    if (!mesh.material) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      mat.side = THREE.FrontSide
      if (!('roughness' in mat)) continue
      const std = mat as THREE.MeshStandardMaterial
      if (std.userData.stageLitV4) continue
      // Keep albedo/saturation intact — wash came from blasting color + exposure.
      std.envMapIntensity = 0.25
      std.roughness = Math.min(Math.max(std.roughness ?? 0.72, 0.55), 0.9)
      std.metalness = Math.min(std.metalness ?? 0, 0.12)
      std.emissive = new THREE.Color('#000000')
      std.emissiveIntensity = 0
      std.userData.stageLitV4 = true
      std.needsUpdate = true
    }
  })
}

function isRootPosTrack(trackName: string) {
  return /(^|[/.])Root\.position$/.test(trackName) || trackName === 'Root.position'
}
function isRootQuatTrack(trackName: string) {
  return /(^|[/.])Root\.quaternion$/.test(trackName) || trackName === 'Root.quaternion'
}

/**
 * Walk GLB includes traveling Root.position (about 1.3m over 2.375s). We play the
 * body tracks in place and advance the stage from the clip's own clock so feet
 * stay in sync. Root.quaternion is dropped so facing stays camera-forward.
 */
function prepareClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const next = clip.clone()
  next.name = clip.name
  next.tracks = next.tracks.filter((t) => !isRootPosTrack(t.name) && !isRootQuatTrack(t.name))
  return next
}

function fadeTo(
  actions: Record<string, THREE.AnimationAction | undefined>,
  name: string,
  opts: {
    loop?: THREE.AnimationActionLoopStyles
    fade?: number
    timeScale?: number
    repetitions?: number
    clamp?: boolean
    /** Prefer AnimationAction.crossFadeTo (warps time, smoother shoulders). */
    from?: string
  } = {},
) {
  const next = actions[name]
  if (!next) return null
  const fade = opts.fade ?? 0.28
  const from = opts.from ? actions[opts.from] : undefined

  for (const [key, action] of Object.entries(actions)) {
    if (!action || key === name) continue
    if (from && key === opts.from) continue // crossFadeTo handles this one
    if (!action.isRunning() && action.getEffectiveWeight() <= 0) continue
    action.fadeOut(fade)
    window.setTimeout(() => {
      if (action.getEffectiveWeight() > 0.001) return
      action.stop()
      action.setEffectiveWeight(0)
    }, fade * 1000 + 40)
  }

  next.enabled = true
  next.setLoop(opts.loop ?? THREE.LoopRepeat, opts.repetitions ?? Infinity)
  next.clampWhenFinished = opts.clamp ?? false
  next.setEffectiveTimeScale(opts.timeScale ?? 1)
  next.reset()
  next.setEffectiveWeight(1)
  next.play()

  if (from && (from.isRunning() || from.getEffectiveWeight() > 0.01)) {
    from.crossFadeTo(next, fade, true)
    window.setTimeout(() => {
      if (from.getEffectiveWeight() > 0.001) return
      from.stop()
      from.setEffectiveWeight(0)
    }, fade * 1000 + 40)
  } else {
    next.fadeIn(fade)
  }
  return next
}

/** Play the real walk clip once; stage distance is driven by walk.time. */
function startApproach(actions: Record<string, THREE.AnimationAction | undefined>) {
  return (
    fadeTo(actions, WALK_CLIP, {
      fade: 0.28,
      timeScale: 1,
      loop: THREE.LoopOnce,
      repetitions: 1,
      clamp: true,
      from: IDLE_CLIP,
    }) || fadeTo(actions, FOLD_CLIP, { fade: 0.3 })
  )
}

function startRetreatWalk(actions: Record<string, THREE.AnimationAction | undefined>) {
  return fadeTo(actions, WALK_CLIP, {
    fade: 0.28,
    timeScale: 1,
    loop: THREE.LoopOnce,
    repetitions: 1,
    clamp: true,
    from: IDLE_CLIP,
  })
}

const CHIN_LIFT = 0.55
const NECK_LIFT = 0.18
/** Blend into fold near the end of the walk cycle (not mid-stride). */
const FOLD_BLEND_PROGRESS = 0.78
const FOLD_BLEND_SECONDS = 0.55

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Extra-smooth step — less “robot pivot” than cubic alone. */
function smootherstep(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

function lerpAngle(from: number, to: number, t: number) {
  let diff = to - from
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return from + diff * t
}

function GusModel({ speaking }: { speaking: boolean }) {
  const group = useRef<THREE.Group>(null)
  const stage = useRef<THREE.Group>(null)
  const facing = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(GUS_3D_URL)

  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const actionsRef = useRef<Record<string, THREE.AnimationAction | undefined>>({})
  const phaseRef = useRef<TalkPhase>('idle')
  const stageXRef = useRef(STAGE_X_IDLE)
  const facingYawRef = useRef(FACE_CAM)
  const turnFromRef = useRef(FACE_CAM)
  const turnToRef = useRef(FACE_CAM)
  const turnStartedRef = useRef(0)
  const agreeUntilRef = useRef(0)
  const agreeStartedRef = useRef(0)
  const foldBlendedRef = useRef(false)
  const departTimerRef = useRef<number | null>(null)
  const fitted = useRef(false)
  const headRef = useRef<THREE.Object3D | null>(null)
  const neckRef = useRef<THREE.Object3D | null>(null)

  function beginTurn(toYaw: number) {
    turnFromRef.current = facingYawRef.current
    turnToRef.current = toYaw
    turnStartedRef.current = performance.now()
  }

  function clearDepartTimer() {
    if (departTimerRef.current != null) {
      window.clearTimeout(departTimerRef.current)
      departTimerRef.current = null
    }
  }

  function beginAgree() {
    const phase = phaseRef.current
    if (phase !== 'approach' && phase !== 'talk') return
    phaseRef.current = 'agree'
    agreeStartedRef.current = performance.now()
    agreeUntilRef.current = agreeStartedRef.current + 700
    fadeTo(actionsRef.current, IDLE_CLIP, { fade: 0.5, from: FOLD_CLIP })
  }

  function beginRetreat() {
    foldBlendedRef.current = false
    phaseRef.current = 'retreat'
    // Turn is blended into the first half of this walk (no separate spin-in-place).
    startRetreatWalk(actionsRef.current)
  }

  useEffect(() => {
    applyStageMaterials(scene)
    headRef.current = null
    neckRef.current = null
    scene.traverse((obj) => {
      if (obj.name === 'Head') headRef.current = obj
      if (obj.name === 'NeckTwist02') neckRef.current = obj
    })
  }, [scene])

  function fitOnce() {
    if (fitted.current || !group.current) return
    const root = group.current
    root.position.set(0, 0, 0)
    root.scale.set(1, 1, 1)
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    if (size.y < 0.01) return
    root.scale.setScalar(TARGET_HEIGHT / size.y)
    box.setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    root.position.set(-center.x + 0.08, -box.min.y, -center.z)
    fitted.current = true
  }

  useLayoutEffect(() => {
    fitOnce()
  }, [scene])

  // Idle mixer from the mesh GLB only — never block on gesture files.
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(scene)
    mixerRef.current = mixer
    const actions: Record<string, THREE.AnimationAction | undefined> = {}
    for (const clip of animations) {
      actions[clip.name] = mixer.clipAction(clip, scene)
    }
    actionsRef.current = actions
    fadeTo(actions, IDLE_CLIP, { fade: 0.15 })
    return () => {
      mixer.stopAllAction()
      mixerRef.current = null
      actionsRef.current = {}
    }
  }, [scene, animations])

  // Background-load anim-only GLBs. Failures leave Gus on idle — never Suspense-block him.
  useEffect(() => {
    let cancelled = false
    const loader = new GLTFLoader()
    const urls = Object.values(GUS_ANIM_URLS)

    Promise.all(
      urls.map(
        (url) =>
          new Promise<THREE.AnimationClip[]>((resolve) => {
            loader.load(
              url,
              (gltf) => resolve(gltf.animations ?? []),
              undefined,
              (err) => {
                console.warn('[Gus] anim load failed', url, err)
                resolve([])
              },
            )
          }),
      ),
    ).then((clipGroups) => {
      if (cancelled || !mixerRef.current) return
      const mixer = mixerRef.current
      const actions = { ...actionsRef.current }
      for (const clips of clipGroups) {
        for (const clip of clips) {
          const action = mixer.clipAction(prepareClip(clip), scene)
          action.setEffectiveWeight(0)
          actions[clip.name] = action
        }
      }
      actionsRef.current = actions
    })

    return () => {
      cancelled = true
    }
  }, [scene])

  // Speaking → approach → fold → nod → turn → walk back → face camera.
  // Debounce depart: "sending" often ends before Azure TTS starts, which used to
  // send him home and then yank him forward again when audio began.
  useEffect(() => {
    if (speaking) {
      clearDepartTimer()
      const phase = phaseRef.current
      if (phase === 'idle' || phase === 'agree' || phase === 'retreat' || phase === 'turn_back') {
        facingYawRef.current = FACE_CAM
        if (facing.current) facing.current.rotation.y = FACE_CAM
        phaseRef.current = 'approach'
        foldBlendedRef.current = false
        startApproach(actionsRef.current)
      }
      return
    }

    clearDepartTimer()
    departTimerRef.current = window.setTimeout(() => {
      departTimerRef.current = null
      beginAgree()
    }, 650)

    return () => clearDepartTimer()
  }, [speaking])

  useFrame((_, dt) => {
    if (!fitted.current) fitOnce()

    const mixer = mixerRef.current
    if (mixer) mixer.update(dt)

    // Chin lift after mixer. Safe while any clip that keys Head has weight.
    const acts = actionsRef.current
    const headDriven =
      (acts[IDLE_CLIP]?.getEffectiveWeight() ?? 0) +
        (acts[WALK_CLIP]?.getEffectiveWeight() ?? 0) +
        (acts[FOLD_CLIP]?.getEffectiveWeight() ?? 0) >
      0.05
    let nod = 0
    if (phaseRef.current === 'agree') {
      const elapsed = (performance.now() - agreeStartedRef.current) / 1000
      // One soft yes-nod over ~0.55s (down then up).
      if (elapsed < 0.55) nod = Math.sin((elapsed / 0.55) * Math.PI) * 0.22
    }
    if (headDriven) {
      if (headRef.current) headRef.current.rotation.x += CHIN_LIFT + nod
      if (neckRef.current) neckRef.current.rotation.x += NECK_LIFT + nod * 0.45
    }

    const stageGroup = stage.current
    const facingGroup = facing.current
    if (!stageGroup || !facingGroup) return

    let phase = phaseRef.current

    if (phase === 'approach') {
      // Always approach facing the camera.
      facingYawRef.current = FACE_CAM
      facingGroup.rotation.y = FACE_CAM

      const walk = acts[WALK_CLIP]
      // If speak started before walk.glb finished loading, kick it off now.
      if (walk && walk.getEffectiveWeight() < 0.05 && !walk.isRunning()) {
        startApproach(acts)
      }
      const dur = walk?.getClip().duration || 2.375
      const raw = walk ? Math.min(1, walk.time / Math.max(dur, 0.001)) : 1
      const progress = easeInOutCubic(raw)
      // Distance follows the walk clip clock (not a separate slide timer).
      if (!foldBlendedRef.current) {
        stageXRef.current = THREE.MathUtils.lerp(STAGE_X_IDLE, STAGE_X_NEAR, progress)
      } else {
        stageXRef.current = THREE.MathUtils.damp(stageXRef.current, STAGE_X_NEAR, 4.5, dt)
      }

      if (!foldBlendedRef.current && raw >= FOLD_BLEND_PROGRESS) {
        foldBlendedRef.current = true
        fadeTo(actionsRef.current, FOLD_CLIP, {
          fade: FOLD_BLEND_SECONDS,
          timeScale: 1,
          from: WALK_CLIP,
        }) || fadeTo(actionsRef.current, IDLE_CLIP, { fade: 0.4, from: WALK_CLIP })
      }

      if (raw >= 0.98 || (foldBlendedRef.current && stageXRef.current >= STAGE_X_NEAR - 0.05)) {
        // Hold in talk at the near mark; depart is debounced from speaking=false.
        phaseRef.current = 'talk'
        phase = 'talk'
        stageXRef.current = STAGE_X_NEAR
        if ((acts[FOLD_CLIP]?.getEffectiveWeight() ?? 0) < 0.4) {
          fadeTo(actionsRef.current, FOLD_CLIP, { fade: 0.45, timeScale: 1, from: WALK_CLIP }) ||
            fadeTo(actionsRef.current, IDLE_CLIP, { fade: 0.35 })
        }
      }
    } else if (phase === 'talk') {
      stageXRef.current = STAGE_X_NEAR
    } else if (phase === 'agree') {
      stageXRef.current = STAGE_X_NEAR
      if (performance.now() >= agreeUntilRef.current) {
        beginRetreat()
      }
    } else if (phase === 'retreat') {
      const walk = acts[WALK_CLIP]
      if (walk && walk.getEffectiveWeight() < 0.05 && !walk.isRunning()) {
        startRetreatWalk(acts)
      }
      const dur = walk?.getClip().duration || 2.375
      const raw = walk ? Math.min(1, walk.time / Math.max(dur, 0.001)) : 1
      const progress = easeInOutCubic(raw)
      // Walk home while easing the 180° turn over the first half of the stride.
      stageXRef.current = THREE.MathUtils.lerp(STAGE_X_NEAR, STAGE_X_IDLE, progress)
      const turnT = smootherstep(Math.min(1, raw / RETREAT_TURN_BLEND))
      facingYawRef.current = lerpAngle(FACE_CAM, FACE_AWAY, turnT)
      facingGroup.rotation.y = facingYawRef.current

      if (raw >= 0.98) {
        stageXRef.current = STAGE_X_IDLE
        facingYawRef.current = FACE_AWAY
        facingGroup.rotation.y = FACE_AWAY
        phaseRef.current = 'turn_back'
        beginTurn(FACE_CAM)
        fadeTo(actionsRef.current, IDLE_CLIP, { fade: 0.45, from: WALK_CLIP })
      }
    } else if (phase === 'turn_back') {
      const t = Math.min(1, (performance.now() - turnStartedRef.current) / (TURN_BACK_SECONDS * 1000))
      facingYawRef.current = lerpAngle(turnFromRef.current, turnToRef.current, smootherstep(t))
      facingGroup.rotation.y = facingYawRef.current
      if (t >= 1) {
        facingYawRef.current = FACE_CAM
        facingGroup.rotation.y = FACE_CAM
        phaseRef.current = 'idle'
        fadeTo(actionsRef.current, IDLE_CLIP, { fade: 0.35 })
      }
    }

    stageGroup.position.x = stageXRef.current
  })

  return (
    <group ref={stage} position={[STAGE_X_IDLE, 0, 0]}>
      <group ref={facing} rotation={[0, FACE_CAM, 0]}>
        <group ref={group}>
          <primitive object={scene} />
        </group>
      </group>
    </group>
  )
}

function LoadingFallback() {
  return (
    <mesh position={[0, 0.9, 0]}>
      <capsuleGeometry args={[0.3, 0.75, 4, 12]} />
      <meshStandardMaterial color="#c4a574" wireframe transparent opacity={0.3} />
    </mesh>
  )
}

function SceneLights() {
  // Camera on +X. Soft key (not blown white) + cyan rim so fur / overalls keep color.
  return (
    <>
      <ambientLight intensity={0.42} color="#c8d8e8" />
      <hemisphereLight args={['#dceeff', '#8aa0b4', 0.55]} />

      {/* Front key — warm-neutral so he isn’t chalk-white */}
      <directionalLight position={[4.6, 2.6, 0.3]} intensity={1.85} color="#fff2e4" />
      <directionalLight position={[3.4, 1.4, -0.9]} intensity={0.7} color="#e8f0ff" />
      <pointLight position={[2.4, 1.6, 0.15]} intensity={0.9} color="#ffe8d0" distance={7} decay={2} />

      {/* Soft white-blue fill from above */}
      <directionalLight position={[0.4, 5.5, 0.2]} intensity={0.55} color="#e8f4ff" />

      {/* Cyan tech rim — present, not overpowering */}
      <directionalLight position={[-4.8, 2.4, 0.2]} intensity={2.2} color="#22d3ee" />
      <directionalLight position={[-3.6, 3.0, 1.5]} intensity={0.85} color="#67e8f9" />
      <pointLight position={[-2.4, 1.8, 0]} intensity={1.1} color="#22d3ee" distance={7} decay={2} />

      {/* Ground bounce */}
      <pointLight position={[0.25, 0.08, 0]} intensity={0.45} color="#b8cce0" distance={4} decay={2} />
    </>
  )
}

export function GusAvatarScene({ speaking, className = '' }: { speaking: boolean; className?: string }) {
  return (
    <div className={`relative z-[1] h-full w-full ${className}`.trim()}>
      <Canvas
        camera={{ position: [CAMERA_DISTANCE, 1.7, 0.02], fov: 28, near: 0.1, far: 80 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          premultipliedAlpha: false,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.15
        }}
      >
        <CameraRig />
        <SceneLights />
        <FloorShadows />
        <Suspense fallback={<LoadingFallback />}>
          <GusModel speaking={speaking} />
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload(GUS_3D_URL)
