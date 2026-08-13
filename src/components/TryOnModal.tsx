'use client'
import styles from './TryOnModal.module.css'
import { useState, useEffect, useRef } from 'react'
import { decryptData } from '@/lib/clientEncryption'
import { countFaces } from '@/lib/faceDetection'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import { X, Upload, Sparkles, RefreshCw, CheckCircle2, Lock, CreditCard } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { GarmentType } from '@/lib/garmentType'

const OnDeviceTryOn = dynamic(() => import('./OnDeviceTryOn'), { ssr: false })

interface TryOnModalProps {
  open: boolean
  onClose: () => void
  garmentUrl: string
  productName: string
  skuName?: string
  garmentType?: GarmentType
}

type FaceStatus = 'idle' | 'checking' | 'ok' | 'no-person' | 'multiple'

interface QuotaInfo {
  remaining: number
  free: boolean
  freeLimit: number
  preview: boolean
  package: { expiresAt: string; dailyLimit: number } | null
  price: number
  packageDailyLimit: number
}

export default function TryOnModal({ open, onClose, garmentUrl, productName, skuName, garmentType }: TryOnModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [personFile, setPersonFile] = useState<File | null>(null)
  const [faceStatus, setFaceStatus] = useState<FaceStatus>('idle')
  const [generating, setGenerating] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const [payWall, setPayWall] = useState(false)
  const [paying, setPaying] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setPreviewUrl(null)
    setPersonFile(null)
    setFaceStatus('idle')
    setGenerating(false)
    setResultUrl(null)
    setError(null)
    setPayWall(false)
    setPaying(false)
  }

  const fetchQuota = async () => {
    const token = localStorage.getItem('authToken')
    if (!token) {
      setQuota(null)
      return
    }
    try {
      const res = await fetch('/api/tryon/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setQuota({
        remaining: data.remaining ?? 0,
        free: data.free ?? true,
        freeLimit: data.freeLimit ?? 0,
        preview: data.preview ?? false,
        package: data.package,
        price: data.price ?? 4.99,
        packageDailyLimit: data.packageDailyLimit ?? 20,
      })
    } catch (e) {
      setQuota(null)
    }
  }

  useEffect(() => {
    if (open) {
      reset()
      fetchQuota()
    }
  }, [open])

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }
    setError(null)
    setResultUrl(null)
    setPersonFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    const img = new Image()
    img.src = url
    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.onerror = () => resolve()
    })

    setFaceStatus('checking')
    try {
      const { count } = await countFaces(img)
      if (count === 1) setFaceStatus('ok')
      else if (count === 0) setFaceStatus('no-person')
      else setFaceStatus('multiple')
    } catch (e) {
      setFaceStatus('no-person')
    }
  }

  const buildForm = () => {
    const formData = new FormData()
    formData.append('personImage', personFile!)
    formData.append('garmentUrl', garmentUrl)
    formData.append('garmentDescription', `${productName}${skuName ? ` - ${skuName}` : ''}`)
    return formData
  }

  const generate = async () => {
    if (!personFile) return
    setGenerating(true)
    setError(null)
    try {
      const token = localStorage.getItem('authToken')
      if (!token) throw new Error('Please log in to use Try It On')

      let res = await fetch('/api/tryon', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: buildForm(),
      })
      let result = await res.json()

      if (res.status === 401) throw new Error('Please log in to use Try It On')

      if ((res.status === 402 || res.status === 429) && result.payToContinue) {
        setPayWall(true)
        setError(null)
        return
      }
      if (res.status === 429) throw new Error(result.error || 'Daily try-on limit reached')
      if (!res.ok) throw new Error(result.error || 'Try-on failed. Please try again.')

      const decrypted = decryptData(result.data)
      setResultUrl(decrypted.url)
      setQuota((q) => (q ? { ...q, remaining: decrypted.remaining, free: decrypted.free } : q))
      setFaceStatus('idle')
    } catch (e: any) {
      setError(e.message || 'Try-on failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const payNow = async () => {
    const token = localStorage.getItem('authToken')
    if (!token) {
      setError('Please log in to use Try It On')
      return
    }
    setPaying(true)
    setError(null)
    try {
      const res = await fetch('/api/tryon/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Checkout failed')
      decryptData(result.data)
      setPayWall(false)
      await fetchQuota()
    } catch (e: any) {
      setError(e.message || 'Checkout failed. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  if (!open) return null

  const paywallView = (
    <div className={styles.payWall}>
      <div className={styles.payWallIcon}><Lock size={20} /></div>
      <h4 className={styles.payWallTitle}>Unlock photorealistic results</h4>
      <p className={styles.payWallText}>
        The free preview runs on your device. Get the package for studio-quality, photorealistic try-ons.
      </p>
      <div className={styles.pkgCard}>
        <div className={styles.pkgRow}>
          <span className={styles.pkgName}>Personal Try-On Package</span>
          <span className={styles.pkgPrice}>${(quota?.price ?? 0).toFixed(2)}</span>
        </div>
        <p className={styles.pkgMeta}>
          {quota?.packageDailyLimit ?? 20} try-ons per day · valid 30 days
        </p>
      </div>
      <p className={styles.demoNote}>Demo checkout — no payment gateway connected yet.</p>
      <div className={styles.payActions}>
        <button className={styles.primaryBtn} onClick={payNow} disabled={paying}>
          <CreditCard size={16} /> {paying ? 'Processing...' : `Pay $${(quota?.price ?? 0).toFixed(2)} (Demo)`}
        </button>
        <button className={styles.secondaryBtn} onClick={() => setPayWall(false)} disabled={paying}>
          Cancel
        </button>
      </div>
    </div>
  )

  const serverBody = (
    <>
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
        <p className={styles.successText}><CheckCircle2 size={16} /> Person verified. Ready to generate!</p>
      )}
      {quota && (
        <p className={styles.quotaText}>
          Package active — {quota.remaining} of {quota.package?.dailyLimit} try-ons left today
        </p>
      )}
      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.footer}>
        {faceStatus === 'ok' && !generating && (
          <button className={styles.primaryBtn} onClick={generate}>Generate Try-On</button>
        )}
        {generating && (
          <div className={styles.generating}>
            <span className={styles.spinner} />
            Generating... this can take up to a minute
          </div>
        )}
        <button className={styles.secondaryBtn} onClick={() => fileInputRef.current?.click()} disabled={generating}>
          {previewUrl ? 'Choose a different photo' : 'Upload photo'}
        </button>
      </div>
    </>
  )

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>Try It On</h3>
            <p className={styles.subtitle}>
              Upload a clear photo of yourself and see how it looks on you.
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div className={styles.body}>
          {quota?.preview ? (
            payWall ? (
              paywallView
            ) : (
              <OnDeviceTryOn
                garmentUrl={garmentUrl}
                productName={productName}
                skuName={skuName}
                garmentType={garmentType}
                price={quota.price}
                packageDailyLimit={quota.packageDailyLimit}
                onUpgrade={() => setPayWall(true)}
              />
            )
          ) : !resultUrl ? (
            serverBody
          ) : (
            <>
              <div className={styles.resultBox}>
                <img src={getOptimizedImageUrl(resultUrl, 'w_800,q_auto,f_auto')} alt="Try-on result" />
              </div>
              <p className={styles.successText}><CheckCircle2 size={16} /> Here&apos;s how it looks on you!</p>
              <div className={styles.footer}>
                <button className={styles.secondaryBtn} onClick={reset}><RefreshCw size={16} /> Try another photo</button>
                <button className={styles.primaryBtn} onClick={onClose}>Done</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
