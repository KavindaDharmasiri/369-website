'use client'
import styles from './CustomerHeader.module.css'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { decryptData, encryptData } from '@/lib/clientEncryption'
import { getAuthUser } from '@/lib/auth'

interface CustomerHeaderProps {
  user: any
  onCartOpen: () => void
}

export default function CustomerHeader({ user, onCartOpen }: CustomerHeaderProps) {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    fetchCategories()
    loadCartCount()
    
    // Listen for cart updates
    const handleCartUpdate = () => loadCartCount()
    window.addEventListener('cartUpdated', handleCartUpdate)
    return () => window.removeEventListener('cartUpdated', handleCartUpdate)
  }, [])

  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false)
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showDropdown])

  const fetchCategories = async () => {
    try {
      const encrypted = encryptData({ endpoint: '/api/categories', method: 'GET' })
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: encrypted })
      })
      const result = await res.json()
      const decrypted = decryptData(result.data)
      const activeCategories = (decrypted.categories || []).filter((cat: any) => cat.isActive === true)
      setCategories(activeCategories)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const loadCartCount = async () => {
    const authUser = getAuthUser()
    if (authUser) {
      try {
        const token = localStorage.getItem('authToken')
        const res = await fetch('/api/cart', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const result = await res.json()
        const data = decryptData(result.data)
        setCartCount(data.cartItems?.length || 0)
      } catch (error) {
        setCartCount(0)
      }
    } else {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]')
      setCartCount(cart.length)
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
        <div className={styles.cartIcon} onClick={onCartOpen}>
          <span className={styles.icon}>🛒</span>
          {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
        </div>
        {user ? (
          <div className={styles.userMenu}>
            <span className={styles.icon} onClick={(e) => {
              e.stopPropagation()
              setShowDropdown(!showDropdown)
            }}>👤</span>
            {showDropdown && (
              <div className={styles.dropdown}>
                <button onClick={() => {
                  localStorage.removeItem('authToken')
                  document.cookie = 'authToken=; path=/; max-age=0'
                  router.push('/')
                }}>Logout</button>
              </div>
            )}
          </div>
        ) : (
          <button className={styles.loginBtn} onClick={() => router.push('/signin')}>Login</button>
        )}
      </div>
    </header>
  )
}
