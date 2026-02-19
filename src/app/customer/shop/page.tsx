'use client'
import styles from './shop.module.css'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { decryptData } from '@/lib/clientEncryption'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'

function ShopContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('personalized')
  const [newArrivals, setNewArrivals] = useState<any[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([])
  const [productImages, setProductImages] = useState<{[key: number]: string[]}>({})
  const [currentImageIndex, setCurrentImageIndex] = useState<{[key: number]: number}>({})

  useEffect(() => {
    setUser(getAuthUser())
    const tab = searchParams.get('tab')
    if (tab === 'new') {
      setActiveTab('new')
    }
    fetchNewArrivals()
    fetchFeaturedProducts()
  }, [searchParams])

  const fetchNewArrivals = async () => {
    const res = await fetch('/api/products/new-arrivals')
    const result = await res.json()
    const decrypted = decryptData(result.data)
    const products = decrypted.products || []
    setNewArrivals(products)
    await fetchProductImages(products)
  }

  const fetchFeaturedProducts = async () => {
    const res = await fetch('/api/products/featured')
    const result = await res.json()
    const decrypted = decryptData(result.data)
    const products = decrypted.products || []
    setFeaturedProducts(products)
    await fetchProductImages(products)
  }

  const fetchProductImages = async (products: any[]) => {
    const imagesMap: {[key: number]: string[]} = {}
    for (const product of products) {
      const res = await fetch(`/api/products/${product.id}/images`)
      const result = await res.json()
      const imgs = decryptData(result.data)
      imagesMap[product.id] = imgs?.map((img: any) => img.imageUrl) || [product.prodImg]
    }
    setProductImages(prev => ({...prev, ...imagesMap}))
  }

  const personalizedProducts = [
    { name: 'Curated Wool Blazer', price: '$595' },
    { name: 'Premium Silk Scarf', price: '$185' },
    { name: 'Designer Cashmere Sweater', price: '$495' },
    { name: 'Luxury Leather Belt', price: '$225' },
  ]

  const products = [
    { name: 'Sculpted Wool Jacket', price: '$495' },
    { name: 'Essential Silk Blouse', price: '$285' },
    { name: 'Cashmere Crewneck', price: '$395' },
    { name: 'Tailored Trousers', price: '$325' },
    { name: 'Structured Leather Bag', price: '$645' },
    { name: 'Merino Knit Dress', price: '$425' },
    { name: 'Leather Loafers', price: '$385' },
    { name: 'Camel Overcoat', price: '$895' },
  ]

  const cartItems = [
    { name: 'Sculpted Wool Blazer', color: 'Black', size: 'M', price: 485, quantity: 1 },
    { name: 'Essential Cotton Shirt', color: 'White', size: 'L', price: 195, quantity: 2 },
    { name: 'Cashmere Crewneck', color: 'Gray', size: 'M', price: 320, quantity: 1 },
  ]

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shipping = 25
  const total = subtotal + shipping

  return (
    <div className={styles.container}>
      <CustomerHeader user={user} onCartOpen={() => setIsCartOpen(true)} />

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1>Refined Essentials for Every Day</h1>
          <p>Discover timeless pieces crafted with intention, designed to elevate the everyday with quiet sophistication.</p>
        </div>
        <div className={styles.heroImage}>
          <img src="https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png" alt="Fashion" />
        </div>
      </section>

      <div className={styles.tabs}>
        <div className={`${styles.tab} ${activeTab === 'personalized' ? styles.active : ''}`} onClick={() => setActiveTab('personalized')}>Personalized Gallery</div>
        <div className={`${styles.tab} ${activeTab === 'new' ? styles.active : ''}`} onClick={() => setActiveTab('new')}>New</div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{activeTab === 'personalized' ? 'Personalized For You' : 'New Arrivals'}</h2>
        {(activeTab === 'personalized' ? featuredProducts : newArrivals).length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 20px', color: '#6c757d', minHeight: '300px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '18px', marginBottom: '8px' }}>No products available</p>
              <p style={{ fontSize: '14px', margin: 0 }}>Check back soon for new items</p>
            </div>
          </div>
        ) : (
          <div className={styles.products}>
            {(activeTab === 'personalized' ? featuredProducts : newArrivals).map((product, index) => {
              const images = productImages[product.id] || [product.prodImg]
              const currentIndex = currentImageIndex[product.id] || 0
              return (
            <div key={index} className={styles.product} 
              onMouseEnter={() => {
                if (images.length > 1) {
                  const interval = setInterval(() => {
                    setCurrentImageIndex(prev => ({
                      ...prev,
                      [product.id]: ((prev[product.id] || 0) + 1) % images.length
                    }))
                  }, 1000)
                  product._interval = interval
                }
              }}
              onMouseLeave={() => {
                if (product._interval) {
                  clearInterval(product._interval)
                  setCurrentImageIndex(prev => ({...prev, [product.id]: 0}))
                }
              }}
              onClick={() => router.push(`/customer/product?id=${product.id}`)}>
              <div className={styles.productImage}>
                <img src={images[currentIndex] || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt={product.prodName || product.name} />
              </div>
              <div className={styles.productName}>{product.prodName || product.name}</div>
              <div className={styles.productPrice}>LKR {product.prodPrice || product.price}</div>
            </div>
          )})}
          </div>
        )}
      </section>

      <CustomerFooter />

      {isCartOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsCartOpen(false)}></div>
          <div className={styles.cart}>
            <div className={styles.cartHeader}>
              <div>
                <h2 className={styles.cartTitle}>Shopping Bag</h2>
                <p className={styles.itemCount}>{cartItems.length} items</p>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsCartOpen(false)}>✕</button>
            </div>
            <div className={styles.cartItems}>
              {cartItems.map((item, index) => (
                <div key={index} className={styles.cartItem}>
                  <div className={styles.cartItemImage}>
                    <img src="https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png" alt={item.name} />
                  </div>
                  <div className={styles.cartItemDetails}>
                    <h3 className={styles.cartItemName}>{item.name}</h3>
                    <p className={styles.cartItemVariant}>{item.color} / Size {item.size}</p>
                    <p className={styles.cartItemPrice}>${item.price}</p>
                    <div className={styles.cartItemActions}>
                      <div className={styles.quantity}>
                        <button className={styles.qtyBtn}>−</button>
                        <span>{item.quantity}</span>
                        <button className={styles.qtyBtn}>+</button>
                      </div>
                      <button className={styles.removeBtn}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.cartSummary}>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span>${subtotal.toLocaleString()}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Shipping</span>
                <span>${shipping}</span>
              </div>
              <div className={styles.totalRow}>
                <span>Total</span>
                <span className={styles.totalAmount}>${total.toLocaleString()}</span>
              </div>
              <button className={styles.checkoutBtn}>Proceed to Checkout</button>
              <p className={styles.taxNote}>Taxes calculated at checkout</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function Shop() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ShopContent />
    </Suspense>
  )
}
