'use client'
import styles from './CustomerHeader.module.css'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import { ShoppingCart, User, Search, Heart, Package, LogOut } from 'lucide-react'
import { decryptData } from '@/lib/clientEncryption'
import { getAuthUser, removeAuthToken } from '@/lib/clientAuth'
import Swal from 'sweetalert2'

interface CustomerHeaderProps {
  user: any
  onCartOpen: () => void
}

function CategoryNav({ categories }: { categories: any[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isHome = pathname === '/customer/shop'
  const activeType = pathname === '/customer/category' ? searchParams.get('type') : null

  return (
    <>
      <Link href="/customer/shop" className={`${styles.navLink} ${isHome ? styles.active : ''}`}>Home</Link>
      {categories.map((category) => {
        const type = category.name.toLowerCase()
        return (
          <Link
            key={category.id}
            href={`/customer/category?type=${type}`}
            className={`${styles.navLink} ${activeType === type ? styles.active : ''}`}
          >
            {category.name}
          </Link>
        )
      })}
    </>
  )
}

export default function CustomerHeader({ user, onCartOpen }: CustomerHeaderProps) {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [wishlistCount, setWishlistCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchCategories()
    loadCartCount()
    loadWishlistCount()

    const handleCartUpdate = () => loadCartCount()
    const handleWishlistUpdate = () => loadWishlistCount()
    window.addEventListener('cartUpdated', handleCartUpdate)
    window.addEventListener('wishlistUpdated', handleWishlistUpdate)
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate)
      window.removeEventListener('wishlistUpdated', handleWishlistUpdate)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = () => setShowUserMenu(false)
    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showUserMenu])

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

  const loadWishlistCount = async () => {
    const authUser = getAuthUser()
    if (!authUser) {
      setWishlistCount(0)
      return
    }
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/wishlist', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      const data = decryptData(result.data)
      setWishlistCount(data.wishlist?.length || 0)
    } catch (error) {
      setWishlistCount(0)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchTerm.trim()
    if (q) {
      router.push(`/customer/shop?search=${encodeURIComponent(q)}`)
    }
  }

  const handleSignOut = async () => {
    setShowUserMenu(false)
    const result = await Swal.fire({
      title: 'Sign Out?',
      text: 'Are you sure you want to sign out?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#000',
      cancelButtonColor: '#666',
      confirmButtonText: 'Yes, sign out',
      cancelButtonText: 'Cancel'
    })

    if (result.isConfirmed) {
      removeAuthToken()
      window.dispatchEvent(new Event('cartUpdated'))
      window.dispatchEvent(new Event('wishlistUpdated'))
      router.push('/')
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.logo} onClick={() => router.push('/')}>369</div>
      <nav className={styles.nav}>
        <Suspense fallback={null}>
          <CategoryNav categories={categories} />
        </Suspense>
      </nav>
      <form className={styles.searchBox} onSubmit={handleSearch}>
        <span className={styles.searchIcon}><Search size={16} /></span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search products"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search products"
        />
      </form>
      <div className={styles.icons}>
        <div className={styles.cartIcon} onClick={() => {
          const authUser = getAuthUser()
          if (authUser) {
            router.push('/customer/account/wishlist')
          } else {
            sessionStorage.setItem('redirectAfterLogin', '/customer/account/wishlist')
            router.push('/signin')
          }
        }}>
          <span className={styles.icon}><Heart size={18} /></span>
          {wishlistCount > 0 && <span className={styles.cartBadge}>{wishlistCount}</span>}
        </div>
        <div className={styles.cartIcon} onClick={onCartOpen}>
          <span className={styles.icon}><ShoppingCart size={18} /></span>
          {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
        </div>
        {user ? (
          <div className={styles.userMenu}>
            <span className={styles.icon} onClick={(e) => {
              e.stopPropagation()
              setShowUserMenu((prev) => !prev)
            }}><User size={18} /></span>
            {showUserMenu && (
              <div className={styles.dropdown} onClick={() => setShowUserMenu(false)}>
                <button className={styles.dropdownItem} onClick={() => router.push('/customer/account')}>
                  <User size={16} /> My Account
                </button>
                <button className={styles.dropdownItem} onClick={() => router.push('/customer/account/orders')}>
                  <Package size={16} /> My Orders
                </button>
                <button className={styles.dropdownItem} onClick={() => router.push('/customer/account/wishlist')}>
                  <Heart size={16} /> Wishlist
                </button>
                <button className={`${styles.dropdownItem} ${styles.signOut}`} onClick={handleSignOut}>
                  <LogOut size={16} /> Sign Out
                </button>
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
