'use client'
import styles from './landing.module.css'
import Link from 'next/link'
import { useClientAuthUser } from '@/lib/useClientAuthUser'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import Image from 'next/image'
import AdBanner from '@/components/AdBanner'
import { User } from 'lucide-react'

export default function Landing({
  initialCategories = [],
  initialFeaturedProducts = [],
}: {
  initialCategories?: any[]
  initialFeaturedProducts?: any[]
}) {
  const user = useClientAuthUser()
  // The server already resolved these lists; an empty result is not a loading state.
  const categories = initialCategories
  const featuredProducts = initialFeaturedProducts

  const fallbackImg = "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>369</Link>
        {user ? (
          <Link href="/customer/account" className={styles.userIcon} aria-label="My account"><User size={20} /></Link>
        ) : (
          <Link href="/signin" className={styles.loginBtn}>Login</Link>
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
              <Link
                key={category.id}
                className={styles.shopBtn}
                href={`/customer/category?type=${encodeURIComponent((category.slug || category.name || '').toLowerCase())}`}
              >
                Shop {category.name}
              </Link>
            ))
          ) : (
            <Link className={styles.shopBtn} href="/customer/shop">
              Shop All
            </Link>
          )}
        </div>

        <Link className={styles.browseLink} href="/customer/shop?tab=new">
          Browse New Arrivals
        </Link>
      </main>

      <AdBanner position="home" />

      <section style={{ padding: '20px 60px 80px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 400, marginBottom: '24px', textAlign: 'center', color: 'var(--text)' }}>
          Featured
        </h2>
        {featuredProducts.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {featuredProducts.map((product) => {
              const isOnSale = product.isOnSale === true && Number(product.salePrice) < Number(product.prodPrice)
              return (
                <Link
                  key={product.id}
                  href={`/customer/product?id=${product.slug || product.id}`}
                  style={{ cursor: 'pointer', transition: 'transform 0.3s ease, box-shadow 0.3s ease', display: 'block', color: 'inherit', textDecoration: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <div style={{ aspectRatio: '3 / 4', overflow: 'hidden', borderRadius: 'var(--radius-md)', marginBottom: '12px', position: 'relative' }}>
                    {isOnSale && (
                      <span style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--danger)', color: '#fff', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', padding: '5px 10px', borderRadius: '3px', zIndex: 2 }}>{product.discountPercent}% OFF</span>
                    )}
                    <img src={getOptimizedImageUrl(product.prodImg) || fallbackImg} alt={product.prodName} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>{product.prodName}</div>
                  <div style={{ fontSize: '14px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ color: isOnSale ? 'var(--danger)' : 'var(--muted)', fontWeight: isOnSale ? 600 : 400 }}>
                      LKR {Number(product.salePrice ?? product.prodPrice).toLocaleString()}
                    </span>
                    {isOnSale && <span style={{ color: 'var(--subtle)', fontSize: '13px', textDecoration: 'line-through' }}>LKR {Number(product.originalPrice).toLocaleString()}</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : null}
      </section>
    </div>
  )
}
