'use client'
import styles from './landing.module.css'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { decryptData } from '@/lib/clientEncryption'
import Image from 'next/image'

export default function Landing() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
    setUser(getAuthUser())
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const result = await res.json()
      const decrypted = decryptData(result.data)
      const activeCategories = (decrypted.categories || []).filter((cat: any) => cat.isActive === true)
      setCategories(activeCategories)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>369</div>
        {user ? (
          <span className={styles.userIcon}>👤</span>
        ) : (
          <button className={styles.loginBtn} onClick={() => router.push('/signin')}>Login</button>
        )}
      </header>

      <main className={styles.main}>
        <div className={styles.heroImage}>
          <Image 
            src="https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png" 
            alt="Hero" 
            width={800}
            height={600}
            priority
            quality={85}
          />
        </div>

        <h1 className={styles.title}>Everyday Quiet Luxury</h1>

        <div className={styles.buttons}>
          {categories.map((category) => (
            <button 
              key={category.id}
              className={styles.shopBtn} 
              onClick={() => router.push(`/customer/category?type=${category.name.toLowerCase()}`)}
            >
              Shop {category.name}
            </button>
          ))}
        </div>

        <button className={styles.browseLink} onClick={() => router.push('/customer/shop?tab=new')}>
          Browse New Arrivals
        </button>
      </main>
    </div>
  )
}
