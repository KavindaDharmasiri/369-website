'use client'
import styles from './CustomerHeader.module.css'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { decryptData } from '@/lib/clientEncryption'

interface CustomerHeaderProps {
  user: any
  onCartOpen: () => void
}

export default function CustomerHeader({ user, onCartOpen }: CustomerHeaderProps) {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
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
    <header className={styles.header}>
      <div className={styles.logo} onClick={() => router.push('/')}>369</div>
      <nav className={styles.nav}>
        <Link href="/customer/shop" className={styles.navLink}>Home</Link>
        {categories.map((category) => (
          <Link 
            key={category.id} 
            href={`/customer/category?type=${category.name.toLowerCase()}`} 
            className={styles.navLink}
          >
            {category.name}
          </Link>
        ))}
      </nav>
      <div className={styles.icons}>
        <span className={styles.icon} onClick={onCartOpen}>🛒</span>
        {user ? (
          <span className={styles.icon}>👤</span>
        ) : (
          <button className={styles.loginBtn} onClick={() => router.push('/signin')}>Login</button>
        )}
      </div>
    </header>
  )
}
