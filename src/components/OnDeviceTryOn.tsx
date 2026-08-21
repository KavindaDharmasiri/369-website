'use client'
import styles from './OnDeviceTryOn.module.css'
import { useEffect, useRef, useState } from 'react'
import { renderTryOn, type HemLength } from '@practics/tryon-core'
import { renderPantsToPose } from '@/lib/pantsCompositor'
import { createInferenceWorker } from '@/lib/tryonWorkers'
import type {
  ResultResponse,
  WorkerResponse,
  GarmentAnchors,
  SkirtAnchors,
} from '@practics/tryon-core'
import type { GarmentType } from '@/lib/garmentType'
import { countPersons } from '@/lib/faceDetection'
import { prepareGarment, type PreparedGarment } from '@/lib/garmentCutout'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import { Sparkles, Upload, RefreshCw, CheckCircle2, MonitorSmartphone, Zap, Lock } from 'lucide-react'

type FaceStatus = 'idle' | 'checking' | 'ok' | 'no-person' | 'multiple'
type EngineStatus = 'loading' | 'ready' | 'error'

interface OnDeviceTryOnProps {
  garmentUrl: string
  productName: string
  skuName?: string
  garmentType?: GarmentType
  price?: number
  packageDailyLimit?: number
  onUpgrade: () => void
}

const PROCESS_TIMEOUT = 45000

const COVERAGE_EXPAND = 1.06

function expandAnchors<T extends Record<string, readonly [number, number]>>(anchors: T, factor: number): T {
  const points = Object.values(anchors)
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length
  const out: Record<string, [number, number]> = {}
  for (const key of Object.keys(anchors)) {
    const [x, y] = anchors[key]
    out[key] = [cx + (x - cx) * factor, cy + (y - cy) * factor]
  }
  return out as unknown as T
}

const FIT_CONFIG = {
  anchors: { widthScale: { shoulder: 1.28, hip: 1.45 } },
  warpGrid: { cols: 32, rows: 48 },
}

function sampleLumMap(src: CanvasImageSource, size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(src, 0, 0, size, size)
  const d = ctx.getImageData(0, 0, size, size).data
  const n = size * size
  const lum = new Float32Array(n)
  const alpha = new Float32Array(n)
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    lum[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    alpha[j] = d[i + 3] / 255
  }
  return { lum, alpha }
}

function weightedMeanLum(lum: Float32Array, alpha: Float32Array, minAlpha: number) {
  let sum = 0
  let n = 0
  for (let i = 0; i < lum.length; i++) {
    if (alpha[i] < minAlpha) continue
    sum += lum[i]
    n++
  }
  return n ? sum / n : 128
}

async function adjustGarmentToPersonLighting(
  garment: ImageBitmap,
  frame: ImageBitmap,
  mask: ImageBitmap
): Promise<HTMLCanvasElement> {
  const SIZE = 64
  const personLum = weightedMeanLum(
    sampleLumMap(frame, SIZE).lum,
    sampleLumMap(mask, SIZE).alpha,
    0.2
  )
  const garmentMap = sampleLumMap(garment, SIZE)
  const garmentLum = weightedMeanLum(garmentMap.lum, garmentMap.alpha, 0.2)
  const factor = Math.min(1.9, Math.max(0.55, personLum / garmentLum))

  const canvas = document.createElement('canvas')
  canvas.width = garment.width
  canvas.height = garment.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(garment, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    px[i] = Math.min(255, px[i] * factor)
    px[i + 1] = Math.min(255, px[i + 1] * factor)
    px[i + 2] = Math.min(255, px[i + 2] * factor)
  }
  ctx.putImageData(data, 0, 0)
  return canvas
}

export default function OnDeviceTryOn({
  garmentUrl,
  productName,
  skuName,
  garmentType = 'upper_body',
  price = 4.99,
  packageDailyLimit = 20,
  onUpgrade,
}: OnDeviceTryOnProps) {
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('loading')
  const [engineBackend, setEngineBackend] = useState<'webgpu' | 'wasm' | null>(null)
  const [engineError, setEngineError] = useState<string | null>(null)

  const [garmentStatus, setGarmentStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [garmentError, setGarmentError] = useState<string | null>(null)

  const [personFile, setPersonFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [faceStatus, setFaceStatus] = useState<FaceStatus>('idle')

  const [generating, setGenerating] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const garmentRef = useRef<PreparedGarment | null>(null)
  const pendingRef = useRef(new Map<number, { resolve: (r: ResultResponse) => void; reject: (e: Error) => void }>())
  const seqRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)

  const clearPreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  useEffect(() => {
    const worker = createInferenceWorker()
    workerRef.current = worker
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data
      if (msg.type === 'ready') {
        setEngineStatus('ready')
        setEngineBackend(msg.backend)
      } else if (msg.type === 'error') {
        if (msg.seq != null) {
          const resolver = pendingRef.current.get(msg.seq)
          if (resolver) {
            pendingRef.current.delete(msg.seq)
            resolver.reject(new Error(msg.message))
          }
        } else {
          setEngineStatus('error')
          setEngineError(msg.message)
        }
      } else if (msg.type === 'result') {
        const resolver = pendingRef.current.get(msg.seq)
        if (resolver) {
          pendingRef.current.delete(msg.seq)
          resolver.resolve(msg)
        } else {
          // Late/stray result (e.g. after the caller timed out or unmounted):
          // close its bitmap or the GPU-backed memory leaks.
          msg.maskBitmap.close()
        }
      }
    }
    worker.postMessage({
      type: 'init',
      wasmPath: '/litert-wasm/',
      modelPaths: {
        segmenter: '/models/selfie_segmenter.tflite',
        pose: '/models/movenet_singlepose_lightning.tflite',
      },
      accelerator: 'webgpu',
    })
    return () => {
      for (const { reject } of pendingRef.current.values()) {
        reject(new Error('Preview engine was closed'))
      }
      pendingRef.current.clear()
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setGarmentStatus('loading')
    setGarmentError(null)
    setResultUrl(null)
    prepareGarment(getOptimizedImageUrl(garmentUrl, 'w_900,q_auto,f_auto'))
      .then((prepared) => {
        if (cancelled) return
        if (!prepared) {
          setGarmentStatus('error')
          setGarmentError('Could not isolate the garment from this product photo.')
          return
        }
        garmentRef.current?.bitmap.close()
        garmentRef.current = prepared
        setGarmentStatus('ok')
      })
      .catch((err: Error) => {
        if (cancelled) return
        setGarmentStatus('error')
        setGarmentError(err.message || 'Could not prepare the garment image.')
      })
    return () => {
      cancelled = true
    }
  }, [garmentUrl])

  useEffect(() => {
    return () => {
      garmentRef.current?.bitmap.close()
      garmentRef.current = null
      clearPreviewUrl()
    }
  }, [])

  const reset = () => {
    setPersonFile(null)
    clearPreviewUrl()
    setPreviewUrl(null)
    setFaceStatus('idle')
    setResultUrl(null)
    setError(null)
  }

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }
    setError(null)
    setResultUrl(null)
    setPersonFile(file)
    clearPreviewUrl()
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setPreviewUrl(url)

    const img = new Image()
    img.src = url
    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.onerror = () => resolve()
    })

    setFaceStatus('checking')
    try {
      const { count } = await countPersons(img)
      if (count === 1) setFaceStatus('ok')
      else if (count === 0) setFaceStatus('no-person')
      else setFaceStatus('multiple')
    } catch {
      setFaceStatus('no-person')
    }
  }

  const generate = async () => {
    const worker = workerRef.current
    const garment = garmentRef.current
    if (!personFile || !worker || !garment) return
    setGenerating(true)
    setError(null)
    let renderFrame: ImageBitmap | null = null
    try {
      renderFrame = await createImageBitmap(personFile)
      const frame = await createImageBitmap(personFile)
      const seq = ++seqRef.current
      const resultPromise = new Promise<ResultResponse>((resolve, reject) => {
        pendingRef.current.set(seq, { resolve, reject })
      })
      worker.postMessage({ type: 'process', bitmap: frame, seq }, [frame])

      const timeout = setTimeout(() => {
        const resolver = pendingRef.current.get(seq)
        if (resolver) {
          pendingRef.current.delete(seq)
          resolver.reject(new Error('Try-on is taking too long. Please try again.'))
        }
      }, PROCESS_TIMEOUT)

      const result = await resultPromise
      clearTimeout(timeout)

      const canvas = document.createElement('canvas')
      canvas.width = renderFrame.width
      canvas.height = renderFrame.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 2D not supported')

      const pants = garmentType === 'lower_body'
      const hemLength: HemLength = pants
        ? (garment.tall ? 'ankle' : 'knee')
        : garmentType === 'upper_body'
          ? 'hip'
          : (garment.tall ? 'ankle' : 'knee')

      const srcAnchors = pants
        ? garment.pantsAnchors
        : expandAnchors(garment.anchors, COVERAGE_EXPAND)

      let status: 'ok' | 'pose-not-anchorable'
      try {
        const garmentLayer = await adjustGarmentToPersonLighting(
          garment.bitmap,
          renderFrame,
          result.maskBitmap
        )
        status = pants
          ? renderPantsToPose(ctx, {
              frame: renderFrame,
              maskBitmap: result.maskBitmap,
              keypoints: result.keypoints,
              garmentImage: garmentLayer,
              garmentAnchors: srcAnchors as SkirtAnchors,
              hemLength,
              config: FIT_CONFIG,
            })
          : renderTryOn(ctx, {
              frame: renderFrame,
              maskBitmap: result.maskBitmap,
              keypoints: result.keypoints,
              garmentImage: garmentLayer,
              garmentAnchors: srcAnchors as GarmentAnchors,
              hemLength,
              config: FIT_CONFIG,
            })
      } finally {
        result.maskBitmap.close()
      }
      if (status === 'pose-not-anchorable') {
        setError(pants
          ? 'Could not detect a full body pose in your photo. Try a photo where your full body is visible.'
          : 'Could not detect a full body pose in your photo. Try a photo where your full upper body is visible.')
        return
      }
      setResultUrl(canvas.toDataURL('image/jpeg', 0.9))
    } catch (e: any) {
      setError(e.message || 'Try-on failed. Please try again.')
    } finally {
      renderFrame?.close()
      setGenerating(false)
    }
  }

  const ready = engineStatus === 'ready' && garmentStatus === 'ok'

  return (
    <div className={styles.container}>
      <div className={styles.freeBadge}>
        <Zap size={14} />
        Free instant preview — runs on your device, no upload to the server
        {engineBackend === 'wasm' && <span className={styles.cpuNote}> (CPU mode, a bit slower)</span>}
      </div>

      <div className={styles.panels}>
        <div className={styles.panel}>
          <span className={styles.panelLabel}>Selected item</span>
          <div className={styles.garmentBox}>
            <img src={getOptimizedImageUrl(garmentUrl)} alt="Selected garment" />
          </div>
          <p className={styles.panelName}>{productName}{skuName ? ` (${skuName})` : ''}</p>
        </div>
        <div className={styles.panel}>
          <span className={styles.panelLabel}>Your photo</span>
          {previewUrl ? (
            <div className={styles.photoBox}><img src={previewUrl} alt="Your photo" /></div>
          ) : (
            <button className={styles.uploadBox} onClick={() => fileInputRef.current?.click()}>
              <Upload size={28} />
              <span>Upload photo</span>
            </button>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />

      {engineStatus === 'loading' && (
        <p className={styles.checking}><Sparkles size={16} /> Loading the preview engine (first use downloads ~5 MB)...</p>
      )}
      {engineStatus === 'error' && (
        <p className={styles.errorText}>Preview engine failed to load: {engineError}</p>
      )}
      {garmentStatus === 'loading' && (
        <p className={styles.checking}><Sparkles size={16} /> Preparing garment preview...</p>
      )}
      {garmentStatus === 'error' && (
        <p className={styles.errorText}>{garmentError}</p>
      )}

      {faceStatus === 'checking' && (
        <p className={styles.checking}><Sparkles size={16} /> Checking for exactly one person...</p>
      )}
      {faceStatus === 'no-person' && (
        <p className={styles.errorText}>No person detected. Please upload a clear photo of one person.</p>
      )}
      {faceStatus === 'multiple' && (
        <p className={styles.errorText}>More than one person detected. Please upload a photo with only yourself.</p>
      )}
      {faceStatus === 'ok' && (
        <p className={styles.successText}><CheckCircle2 size={16} /> Person verified. Ready to preview!</p>
      )}
      {error && <p className={styles.errorText}>{error}</p>}

      {resultUrl ? (
        <>
          <div className={styles.resultBox}>
            <img src={resultUrl} alt="Try-on preview" />
          </div>
          <p className={styles.successText}><CheckCircle2 size={16} /> Here&apos;s how it looks on you!</p>
          <p className={styles.previewNote}>
            <MonitorSmartphone size={14} /> This is an on-device preview. For a photorealistic result, get the package.
          </p>
          <div className={styles.footer}>
            <button className={styles.secondaryBtn} onClick={reset}><RefreshCw size={16} /> Try another photo</button>
            <button className={styles.upgradeBtn} onClick={onUpgrade}><Lock size={16} /> Get photorealistic — ${price.toFixed(2)}</button>
          </div>
        </>
      ) : (
        <div className={styles.footer}>
          {faceStatus === 'ok' && ready && !generating && (
            <button className={styles.primaryBtn} onClick={generate}>
              <Sparkles size={16} /> Preview Try-On
            </button>
          )}
          {generating && (
            <div className={styles.generating}>
              <span className={styles.spinner} />
              Previewing... just a moment
            </div>
          )}
          <button className={styles.secondaryBtn} onClick={() => fileInputRef.current?.click()} disabled={generating}>
            {previewUrl ? 'Choose a different photo' : 'Upload photo'}
          </button>
          <button className={styles.upgradeBtn} onClick={onUpgrade} disabled={generating}>
            <Lock size={16} /> Upgrade — photorealistic results ({packageDailyLimit}/day · ${price.toFixed(2)})
          </button>
        </div>
      )}
    </div>
  )
}
