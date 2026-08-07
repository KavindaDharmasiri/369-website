'use client'
import { useEffect, useState } from 'react'
import { decryptData } from '@/lib/clientEncryption'
import styles from './AdBanner.module.css'

interface AdBannerProps {
  position?: string
}

export default function AdBanner({ position = 'home' }: AdBannerProps) {
  const [banners, setBanners] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/ads?position=${position}`)
      .then(async (res) => {
        if (!res.ok) return
        const json = await res.json()
        const decrypted = decryptData(json.data)
        if (!cancelled) setBanners(decrypted?.banners || [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [position])

  if (!banners.length) return null

  return (
    <div className={styles.container}>
      {banners.map((b) => (
        <a
          key={b.id}
          href={b.linkUrl || undefined}
          target={b.linkUrl ? '_blank' : undefined}
          rel={b.linkUrl ? 'noopener noreferrer' : undefined}
          className={styles.banner}
        >
          <img src={b.imageUrl} alt={b.title} loading="lazy" decoding="async" />
          {b.title && <span className={styles.title}>{b.title}</span>}
        </a>
      ))}
    </div>
  )
}
