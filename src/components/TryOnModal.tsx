'use client'
import styles from './TryOnModal.module.css'
import { useState, useEffect, useRef } from 'react'
import { countPersons } from '@/lib/faceDetection'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import { X, Upload, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react'

interface TryOnModalProps {
  open: boolean
  onClose: () => void
  garmentUrl: string
  productName: string
  skuName?: string
}

type PersonStatus = 'idle' | 'checking' | 'ok' | 'no-person' | 'multiple'

export default function TryOnModal({ open, onClose, garmentUrl, productName, skuName }: TryOnModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [personFile, setPersonFile] = useState<File | null>(null)
  const [personStatus, setPersonStatus] = useState<PersonStatus>('idle')
  const [generating, setGenerating] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)

  const clearPreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  const reset = () => {
    clearPreviewUrl()
    setPreviewUrl(null)
    setPersonFile(null)
    setPersonStatus('idle')
    setGenerating(false)
    setResultUrl(null)
    setError(null)
  }

  useEffect(() => {
    if (open) reset()
    return clearPreviewUrl
  }, [open])

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

    setPersonStatus('checking')
    try {
      const { count } = await countPersons(img)
      if (count === 1) setPersonStatus('ok')
      else if (count === 0) setPersonStatus('no-person')
      else setPersonStatus('multiple')
    } catch {
      setPersonStatus('no-person')
    }
  }

  const generate = async () => {
    if (!personFile) return
    setGenerating(true)
    setError(null)
    try {
      const token = localStorage.getItem('authToken')
      if (!token) throw new Error('Please log in to use Try It On')

      const formData = new FormData()
      formData.append('personImage', personFile)
      formData.append('garmentUrl', garmentUrl)
      formData.append('garmentDescription', `${productName}${skuName ? ` - ${skuName}` : ''}`)

      const res = await fetch('/api/tryon', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const result = await res.json()

      if (res.status === 401) throw new Error('Please log in to use Try It On')
      if (!res.ok) throw new Error(result.error || 'Try-on failed. Please try again.')
      if (!result.url) throw new Error('Try-on failed. Please try again.')

      setResultUrl(result.url)
      setPersonStatus('idle')
    } catch (e: any) {
      setError(e.message || 'Try-on failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (!open) return null

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
          {!resultUrl ? (
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

              {personStatus === 'checking' && (
                <p className={styles.checking}><Sparkles size={16} /> Checking for exactly one person...</p>
              )}
              {personStatus === 'no-person' && (
                <p className={styles.errorText}>No person detected. Please upload a clear photo of one person.</p>
              )}
              {personStatus === 'multiple' && (
                <p className={styles.errorText}>More than one person detected. Please upload a photo with only yourself.</p>
              )}
              {personStatus === 'ok' && (
                <p className={styles.successText}><CheckCircle2 size={16} /> Person verified. Ready to generate!</p>
              )}
              {error && <p className={styles.errorText}>{error}</p>}

              <div className={styles.footer}>
                {personStatus === 'ok' && !generating && (
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
