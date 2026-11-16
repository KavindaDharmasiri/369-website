'use client'
import styles from './shop.module.css'
import { useState, useEffect, memo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getAuthUser } from '@/lib/clientAuth'
import { useClientAuthUser } from '@/lib/useClientAuthUser'
import { decryptData } from '@/lib/clientEncryption'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import CustomerHeader from '@/components/CustomerHeader'
import { useEngagement } from '@/lib/engagement/tracker'
import CustomerFooter from '@/components/CustomerFooter'
import Cart from '@/components/Cart'
import AdBanner from '@/components/AdBanner'
import { CardsSkeleton } from '@/components/Skeleton'
import Swal from 'sweetalert2'
import { Heart, ShoppingCart } from 'lucide-react'

const FALLBACK_IMG = "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"

const ProductCard = memo(function ProductCard({ product }: { product: any }) {
  const router = useRouter()
  const [imageIndex, setImageIndex] = useState(0)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const images = product.productImages && product.productImages.length > 0
    ? product.productImages.map((img: any) => img.imageUrl)
    : [product.prodImg]
  const isOnSale = product.isOnSale === true && Number(product.salePrice) < Number(product.prodPrice)

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const authUser = getAuthUser()
    if (!authUser) {
      sessionStorage.setItem('redirectAfterLogin', '/customer/account/wishlist')
      router.push('/signin')
      return
    }
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId: product.id, skuId: null })
      })
      if (res.ok) {
        setIsWishlisted(true)
        window.dispatchEvent(new Event('wishlistUpdated'))
        Swal.fire({ icon: 'success', title: 'Added to Wishlist', confirmButtonColor: '#000', timer: 1500 })
      }
    } catch (error) {
      console.error('Failed to update wishlist:', error)
    }
  }

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // A card does not have enough information to choose a saleable size/color SKU.
    const identifier = product.slug || product.id
    router.push(`/customer/product?id=${identifier}`)
  }

  return (
    <Link
      href={`/customer/product?id=${product.slug || product.id}`}
      className={styles.product}
      onMouseEnter={() => {
        if (images.length > 1) {
          setImageIndex((prev) => (prev + 1) % images.length)
        }
      }}
    >
      <div className={`${styles.productImage} ${styles.productImageWrap}`}>
        {isOnSale && <span className={styles.saleBadge}>{product.discountPercent}% OFF</span>}
        <button
          className={`${styles.wishlistBtn} ${isWishlisted ? styles.wishlistActive : ''}`}
          onClick={handleWishlist}
          aria-label={isWishlisted ? 'In wishlist' : 'Add to wishlist'}
        >
          <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
        <img
          src={getOptimizedImageUrl(images[imageIndex]) || FALLBACK_IMG}
          alt={product.prodName}
          loading="lazy"
          decoding="async"
        />
        <button className={styles.quickAdd} onClick={handleQuickAdd}>
          <ShoppingCart size={14} /> Choose options
        </button>
      </div>
      <div className={styles.productName}>{product.prodName}</div>
      <div className={styles.productPriceRow}>
        <div className={`${styles.productPrice} ${isOnSale ? styles.salePrice : ''}`}>LKR {Number(product.salePrice ?? product.prodPrice).toLocaleString()}</div>
        {isOnSale && <div className={styles.originalPrice}>LKR {Number(product.originalPrice).toLocaleString()}</div>}
      </div>
    </Link>
  )
})

function ShopContent({
  initialTab = 'personalized',
  initialFeaturedProducts = [],
  initialNewArrivals = [],
}: {
  initialTab?: 'personalized' | 'new'
  initialFeaturedProducts?: any[]
  initialNewArrivals?: any[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isCartOpen, setIsCartOpen] = useState(false)
  const user = useClientAuthUser()
  const engagement = useEngagement()
  const newArrivals = initialNewArrivals
  const featuredProducts = initialFeaturedProducts
  const [searchState, setSearchState] = useState<{ query: string; products: any[]; error: string } | null>(null)

  const activeTab = initialTab
  const search = (searchParams.get('search') || searchParams.get('q') || '').trim()
  const searchLoading = Boolean(search) && searchState?.query !== search
  const searchResults = searchState?.query === search ? searchState.products : []
  const searchError = searchState?.query === search ? searchState.error : ''

  useEffect(() => {
    if (!search) return
    const controller = new AbortController()
    fetch(`/api/products/search?q=${encodeURIComponent(search)}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error('Search is temporarily unavailable. Please try again.')
        return res.json()
      })
      .then(result => {
        if (controller.signal.aborted) return
        const decrypted = decryptData(result.data)
        const products = decrypted.products || []
        setSearchState({ query: search, products, error: '' })
        engagement?.track({ eventType: 'search', searchQuery: search, pageType: 'shop', metadata: { resultCount: products.length } })
      })
      .catch(error => {
        if (!controller.signal.aborted) setSearchState({ query: search, products: [], error: error.message })
      })
    return () => controller.abort()
  }, [search])

  const handleTabClick = (tabName: 'personalized' | 'new') => {
    router.push(tabName === 'new' ? '/customer/shop?tab=new' : '/customer/shop')
  }

  const visibleProducts = activeTab === 'personalized' ? featuredProducts : newArrivals

  return (
    <div className={styles.container}>
      <CustomerHeader user={user} onCartOpen={() => setIsCartOpen(true)} />

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1>Refined Essentials for Every Day</h1>
          <p>Discover timeless pieces crafted with intention, designed to elevate the everyday with quiet sophistication.</p>
        </div>
        <div className={styles.heroImage}>
          <img src={getOptimizedImageUrl(FALLBACK_IMG, 'w_1200,q_auto,f_auto')} alt="Fashion" loading="lazy" decoding="async" />
        </div>
      </section>

      <AdBanner position="shop" />

      {search ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Results for &ldquo;{search}&rdquo;</h2>
          {searchLoading ? (
            <CardsSkeleton count={8} />
          ) : searchError ? (
            <p role="alert">{searchError}</p>
          ) : searchResults.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 20px', color: '#6c757d', minHeight: '300px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '18px', marginBottom: '8px' }}>No products found</p>
                <p style={{ fontSize: '14px', margin: 0 }}>Try a different search term</p>
              </div>
            </div>
          ) : (
            <div className={styles.products}>
              {searchResults.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <div className={styles.tabs}>
            <div className={`${styles.tab} ${activeTab === 'personalized' ? styles.active : ''}`} onClick={() => handleTabClick('personalized')}>Personalized Gallery</div>
            <div className={`${styles.tab} ${activeTab === 'new' ? styles.active : ''}`} onClick={() => handleTabClick('new')}>New</div>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{activeTab === 'personalized' ? 'Personalized For You' : 'New Arrivals'}</h2>
            {visibleProducts.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 20px', color: '#6c757d', minHeight: '300px' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '18px', marginBottom: '8px' }}>No products available</p>
                  <p style={{ fontSize: '14px', margin: 0 }}>Check back soon for new items</p>
                </div>
              </div>
            ) : (
              <div className={styles.products}>
                {visibleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <CustomerFooter />

      <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  )
}

export default function Shop({
  initialTab = 'personalized',
  initialFeaturedProducts = [],
  initialNewArrivals = [],
}: {
  initialTab?: 'personalized' | 'new'
  initialFeaturedProducts?: any[]
  initialNewArrivals?: any[]
}) {
  return (
    <Suspense fallback={<div style={{ padding: '60px 20px', textAlign: 'center' }}><CardsSkeleton count={8} /></div>}>
      <ShopContent
        initialTab={initialTab}
        initialFeaturedProducts={initialFeaturedProducts}
        initialNewArrivals={initialNewArrivals}
      />
    </Suspense>
  )
}
