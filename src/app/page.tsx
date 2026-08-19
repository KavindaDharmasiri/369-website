'use client'
import styles from './landing.module.css'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser } from '@/lib/clientAuth'
import { decryptData } from '@/lib/clientEncryption'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import Image from 'next/image'
import AdBanner from '@/components/AdBanner'
import { CardsSkeleton } from '@/components/Skeleton'
import { User } from 'lucide-react'

export default function Landing() {
  const [featuredLoading, setFeaturedLoading] = useState(true)
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([])

  useEffect(() => {
    setUser(getAuthUser())
    fetchCategories()
    fetchFeaturedProducts()
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

  const fetchFeaturedProducts = async () => {
    try {
      const res = await fetch('/api/products/featured')
      const result = await res.json()
      const decrypted = decryptData(result.data)
      setFeaturedProducts(decrypted.products || [])
    } catch (error) {
      setFeaturedProducts([])
    } finally {
      setFeaturedLoading(false)
    }
  }

  const fallbackImg = "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo} onClick={() => router.push('/')}>369</div>
        {user ? (
          <span className={styles.userIcon} onClick={() => router.push('/customer/account')}><User size={20} /></span>
        ) : (
          <button className={styles.loginBtn} onClick={() => router.push('/signin')}>Login</button>
        )}
      </header>

      <main className={styles.main}>
        <div className={styles.heroImage}>
          <Image
            src={fallbackImg}
            alt="Hero"
            width={800}
            height={600}
            priority
            quality={85}
          />
        </div>

        <h1 className={styles.title}>Everyday Quiet Luxury</h1>

        <div className={styles.buttons}>
          {categories.length > 0 ? (
            categories.map((category) => (
              <button
                key={category.id}
                className={styles.shopBtn}
                onClick={() => router.push(`/customer/category?type=${category.name.toLowerCase()}`)}
              >
                Shop {category.name}
              </button>
            ))
          ) : (
            <button className={styles.shopBtn} onClick={() => router.push('/customer/shop')}>
              Shop All
            </button>
          )}
        </div>

        <button className={styles.browseLink} onClick={() => router.push('/customer/shop?tab=new')}>
          Browse New Arrivals
        </button>
      </main>

      <AdBanner position="home" />

      <section style={{ padding: '20px 60px 80px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 400, marginBottom: '24px', textAlign: 'center', color: 'var(--text)' }}>
          Featured
        </h2>
        {featuredLoading ? (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <CardsSkeleton count={8} />
          </div>
        ) : featuredProducts.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {featuredProducts.map((product) => {
              const isOnSale = product.isOnSale === true && Number(product.salePrice) < Number(product.prodPrice)
              return (
                <div
                  key={product.id}
                  onClick={() => router.push(`/customer/product?id=${product.id}`)}
                  style={{ cursor: 'pointer', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <div style={{ aspectRatio: '3 / 4', overflow: 'hidden', borderRadius: 'var(--radius-md)', marginBottom: '12px', position: 'relative' }}>
                    {isOnSale && (
                      <span style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--error)', color: '#fff', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', padding: '5px 10px', borderRadius: 'var(--radius-xs)', zIndex: 2 }}>{product.discountPercent}% OFF</span>
                    )}
                    <img src={getOptimizedImageUrl(product.prodImg) || fallbackImg} alt={product.prodName} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>{product.prodName}</div>
                  <div style={{ fontSize: '14px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ color: isOnSale ? 'var(--error)' : 'var(--text-secondary)', fontWeight: isOnSale ? 600 : 400 }}>
                      LKR {Number(product.salePrice ?? product.prodPrice).toLocaleString()}
                    </span>
                    {isOnSale && <span style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'line-through' }}>LKR {Number(product.originalPrice).toLocaleString()}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </section>
    </div>
  )
}
