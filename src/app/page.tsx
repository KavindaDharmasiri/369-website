'use client'
import styles from './page.module.css'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getAuthUser } from '@/lib/auth'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const heroImage = 'https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png'

  useEffect(() => {
    setUser(getAuthUser())
  }, [])

  return (
    <main className={styles.container}>
      {!user && (
        <button className={styles.loginBtn} onClick={() => router.push('/signin')}>
          Login
        </button>
      )}
      
      <header className={styles.logo}>369</header>
      
      <div className={styles.heroImage}>
        <img src={heroImage} alt="Fashion model" />
      </div>
      
      <h1 className={styles.title}>Everyday Quiet Luxury</h1>
      
      <div className={styles.buttons}>
        <button className={styles.btn} onClick={() => router.push('/customer/shop')}>Shop Women</button>
        <button className={styles.btn} onClick={() => router.push('/customer/shop')}>Shop Men</button>
      </div>
      
      <a onClick={() => router.push('/customer/shop')} className={styles.link} style={{ cursor: 'pointer' }}>Browse New Arrivals</a>
    </main>
  )
}
