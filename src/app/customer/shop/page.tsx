'use client'
import styles from './shop.module.css'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { decryptData } from '@/lib/clientEncryption'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'
import Cart from '@/components/Cart'

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
    try {
      const res = await fetch('/api/products/new-arrivals')
      const result = await res.json()
      console.log('New arrivals response:', result)
      const decrypted = decryptData(result.data)
      console.log('Decrypted new arrivals:', decrypted)
      const products = decrypted.products || []
      setNewArrivals(products)
      await fetchProductImages(products)
    } catch (error) {
      console.error('Error fetching new arrivals:', error)
    }
  }

  const fetchFeaturedProducts = async () => {
    try {
      const res = await fetch('/api/products/featured')
      const result = await res.json()
      console.log('Featured response:', result)
      const decrypted = decryptData(result.data)
      console.log('Decrypted featured:', decrypted)
      const products = decrypted.products || []
      setFeaturedProducts(products)
      await fetchProductImages(products)
    } catch (error) {
      console.error('Error fetching featured products:', error)
    }
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

      <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
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
