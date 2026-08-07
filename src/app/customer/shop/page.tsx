'use client'
import styles from './shop.module.css'
import { useState, useEffect, memo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAuthUser } from '@/lib/clientAuth'
import { decryptData } from '@/lib/clientEncryption'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'
import Cart from '@/components/Cart'
import AdBanner from '@/components/AdBanner'
import { CardsSkeleton } from '@/components/Skeleton'
import Swal from 'sweetalert2'
import { Heart, ShoppingCart } from 'lucide-react'

const FALLBACK_IMG = "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"

const ProductCard = memo(function ProductCard({ product, onClick }: { product: any; onClick: () => void }) {
  const router = useRouter()
  const [imageIndex, setImageIndex] = useState(0)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const images = product.productImages && product.productImages.length > 0
    ? product.productImages.map((img: any) => img.imageUrl)
    : [product.prodImg]
  const isOnSale = product.isOnSale === true && Number(product.salePrice) < Number(product.prodPrice)

  const handleWishlist = async (e: React.MouseEvent) => {
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

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isAdding) return
    setIsAdding(true)
    const authUser = getAuthUser()
    const cartItem = {
      productId: product.id,
      skuId: null,
      quantity: 1,
      price: Number(product.salePrice ?? product.prodPrice),
      originalPrice: Number(product.originalPrice ?? product.prodPrice),
      name: product.prodName,
      image: images[0] || product.prodImg
    }
    try {
      if (authUser) {
        const token = localStorage.getItem('authToken')
        const res = await fetch('/api/cart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(cartItem)
        })
        if (!res.ok) throw new Error('Failed to add to cart')
      } else {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]')
        cart.push(cartItem)
        localStorage.setItem('cart', JSON.stringify(cart))
      }
      window.dispatchEvent(new Event('cartUpdated'))
      Swal.fire({ icon: 'success', title: 'Added to Cart', confirmButtonColor: '#000', timer: 1500 })
    } catch (error) {
      console.error('Failed to add to cart:', error)
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to add to cart', confirmButtonColor: '#000' })
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div
      key={product.id}
      className={styles.product}
      onMouseEnter={() => {
        if (images.length > 1) {
          setImageIndex((prev) => (prev + 1) % images.length)
        }
      }}
      onClick={onClick}
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
        <button className={styles.quickAdd} onClick={handleQuickAdd} disabled={isAdding}>
          <ShoppingCart size={14} /> {isAdding ? 'Adding…' : 'Add to Cart'}
        </button>
      </div>
      <div className={styles.productName}>{product.prodName}</div>
      <div className={styles.productPriceRow}>
        <div className={`${styles.productPrice} ${isOnSale ? styles.salePrice : ''}`}>LKR {Number(product.salePrice ?? product.prodPrice).toLocaleString()}</div>
        {isOnSale && <div className={styles.originalPrice}>LKR {Number(product.originalPrice).toLocaleString()}</div>}
      </div>
    </div>
  )
})

function ShopContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('personalized')
  const [newArrivals, setNewArrivals] = useState<any[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const tab = searchParams.get('tab')
  const search = searchParams.get('search')

  useEffect(() => {
    setUser(getAuthUser())
    if (tab === 'new') {
      setActiveTab('new')
      fetchNewArrivals()
    } else {
      setActiveTab('personalized')
      fetchFeaturedProducts()
    }
  }, [tab])

  useEffect(() => {
    if (search) {
      fetchSearchResults(search)
    }
  }, [search])

  const fetchSearchResults = async (query: string) => {
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`)
      const result = await res.json()
      const decrypted = decryptData(result.data)
      setSearchResults(decrypted.products || [])
    } catch (error) {
      console.error('Error searching products:', error)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const fetchNewArrivals = async () => {
    setProductsLoading(true)
    try {
      const res = await fetch('/api/products/new-arrivals')
      const result = await res.json()
      const decrypted = decryptData(result.data)
      const products = decrypted.products || []
      setNewArrivals(products)
    } catch (error) {
      console.error('Error fetching new arrivals:', error)
    } finally {
      setProductsLoading(false)
    }
  }

  const fetchFeaturedProducts = async () => {
    setProductsLoading(true)
    try {
      const res = await fetch('/api/products/featured')
      const result = await res.json()
      const decrypted = decryptData(result.data)
      const products = decrypted.products || []
      setFeaturedProducts(products)
    } catch (error) {
      console.error('Error fetching featured products:', error)
    } finally {
      setProductsLoading(false)
    }
  }

  const handleTabClick = (tabName: string) => {
    setActiveTab(tabName)
    if (tabName === 'new' && newArrivals.length === 0) {
      fetchNewArrivals()
    } else if (tabName === 'personalized' && featuredProducts.length === 0) {
      fetchFeaturedProducts()
    }
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
                  onClick={() => router.push(`/customer/product?id=${product.id}`)}
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
            {productsLoading ? (
              <CardsSkeleton count={8} />
            ) : visibleProducts.length === 0 ? (
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
                    onClick={() => router.push(`/customer/product?id=${product.id}`)}
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

export default function Shop() {
  return (
    <Suspense fallback={<div style={{ padding: '60px 20px', textAlign: 'center' }}><CardsSkeleton count={8} /></div>}>
      <ShopContent />
    </Suspense>
  )
}
