'use client'
import styles from './product.module.css'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { decryptData } from '@/lib/clientEncryption'
import { useAuditTrail } from '@/lib/useAuditTrail'
import Cart from '@/components/Cart'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'

export default function Product() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const productId = searchParams.get('id')
  const { logActivity } = useAuditTrail()
  const [product, setProduct] = useState<any>(null)
  const [images, setImages] = useState<string[]>([])
  const [defaultImages, setDefaultImages] = useState<string[]>([])
  const [specs, setSpecs] = useState<any[]>([])
  const [selectedSku, setSelectedSku] = useState<any>(null)
  const [selectedSpecs, setSelectedSpecs] = useState<{[key: string]: string}>({})
  const [selectedSize, setSelectedSize] = useState('M')
  const [selectedColor, setSelectedColor] = useState('beige')
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    setUser(getAuthUser())
    if (productId) {
      loadProductData()
    }
  }, [productId])

  const loadProductData = async () => {
    await Promise.all([
      fetchProduct(),
      fetchImages(),
      fetchSpecs()
    ])
  }

  useEffect(() => {
    if (Object.keys(selectedSpecs).length > 0) {
      fetchSkuBySpecs()
    }
  }, [selectedSpecs])

  const fetchProduct = async () => {
    const res = await fetch(`/api/products/${productId}`)
    const result = await res.json()
    const decrypted = decryptData(result.data)
    setProduct(decrypted)
    logActivity('VIEW_PRODUCT', 'product', productId, { 
      productName: decrypted.prodName, 
      category: decrypted.prodCategoryName,
      price: decrypted.prodPrice 
    })
  }

  const fetchImages = async () => {
    const res = await fetch(`/api/products/${productId}/images`)
    const result = await res.json()
    const imgs = decryptData(result.data)
    const imageUrls = imgs?.map((img: any) => img.imageUrl) || []
    setImages(imageUrls)
    setDefaultImages(imageUrls)
  }

  const fetchSpecs = async () => {
    const res = await fetch(`/api/products/${productId}/specs`)
    const result = await res.json()
    const specs = decryptData(result.data)
    setSpecs(specs || [])
  }

  const fetchSkuBySpecs = async () => {
    setIsTransitioning(true)
    const variantKeys = Object.values(selectedSpecs).join(', ')
    const res = await fetch(`/api/products/${productId}/skus?variantKeys=${encodeURIComponent(variantKeys)}`)
    const data = await res.json()
    
    setTimeout(() => {
      if (data.length > 0) {
        const sku = data[0]
        setSelectedSku(sku)
        if (sku.images) {
          const skuImages = JSON.parse(sku.images)
          if (skuImages.length > 0) {
            setImages(skuImages)
          } else {
            setImages(defaultImages)
          }
        } else {
          setImages(defaultImages)
        }
      }
      setTimeout(() => setIsTransitioning(false), 50)
    }, 300)
  }

  const handleSpecSelection = (specName: string, attrName: string) => {
    setSelectedSpecs(prev => ({...prev, [specName]: attrName}))
    logActivity('SELECT_SPEC', 'product', productId, { specName, attrName })
  }

  if (!product) return null

  const relatedProducts = [
    { name: 'Cashmere Crewneck', price: '$495' },
    { name: 'Tailored Wide-Leg Trousers', price: '$595' },
    { name: 'Silk Draped Blouse', price: '$425' },
    { name: 'Italian Leather Loafers', price: '$650' },
  ]

  return (
    <div className={styles.container}>
      <CustomerHeader user={user} onCartOpen={() => setIsCartOpen(true)} />

      <div className={styles.content}>
        <div className={`${styles.images} ${isTransitioning ? styles.fadeOut : styles.fadeIn}`}>
          {images.length > 0 ? images.map((img, index) => (
            <div key={index} className={styles.imageBox}>
              <img src={img} alt={`Product ${index + 1}`} />
            </div>
          )) : (
            <div className={styles.imageBox}>
              <img src={product.prodImg || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt="Product" />
            </div>
          )}
        </div>

        <div className={styles.details}>
          <h1 className={styles.title}>{product.prodName}</h1>
          <div className={`${styles.price} ${isTransitioning ? styles.fadeOut : styles.fadeIn}`}>LKR {selectedSku?.price || product.prodPrice}</div>
          <p className={styles.description}>{product.prodDescription}</p>
          {selectedSku && selectedSku.stock > 0 && <p className={`${styles.stockInfo} ${isTransitioning ? styles.fadeOut : styles.fadeIn}`}>In Stock: {selectedSku.stock} available</p>}
          {selectedSku && selectedSku.stock === 0 && <p className={`${styles.stockInfo} ${styles.outOfStock} ${isTransitioning ? styles.fadeOut : styles.fadeIn}`}>Out of Stock</p>}

          {specs.map((spec, index) => (
            <div key={index} className={styles.option}>
              <label className={styles.label}>{spec.name}</label>
              <div className={styles.sizes}>
                {spec.attributes.map((attr: any, i: number) => (
                  <button 
                    key={i} 
                    className={`${styles.sizeBtn} ${selectedSpecs[spec.name] === attr.name ? styles.selected : ''}`}
                    onClick={() => handleSpecSelection(spec.name, attr.name)}
                  >
                    {attr.name}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button className={styles.addBtn} onClick={() => {
            logActivity('ADD_TO_CART', 'product', productId, { 
              price: selectedSku?.price || product.prodPrice,
              specs: selectedSpecs 
            })
          }}>Add to Bag</button>
          <p className={styles.shipping}>Free shipping on orders over $200</p>

          <div className={styles.tryOn}>
            <div className={styles.tryOnHeader}>
              <span className={styles.tryOnTitle}>AI Try-On</span>
              <span className={styles.beta}>Beta</span>
            </div>
            <p className={styles.tryOnText}>Upload your photo to see how this piece looks on you</p>
            <div className={styles.uploadBox}>
              <div className={styles.uploadIcon}>📷</div>
              <p>Drag and drop your photo</p>
              <p className={styles.uploadSubtext}>or click to browse</p>
            </div>
            <button className={styles.generateBtn}>Generate Try-On</button>
            <div className={styles.tabs}>
              <button className={styles.tab}>Product</button>
              <button className={styles.tab}>On You</button>
            </div>
          </div>

          <div className={styles.accordion}>
            <div className={styles.accordionItem}>Details & Care +</div>
            <div className={styles.accordionItem}>Shipping & Returns +</div>
            <div className={styles.accordionItem}>Size Guide +</div>
          </div>
        </div>
      </div>

      <section className={styles.related}>
        <h2 className={styles.relatedTitle}>You Also Might Like</h2>
        <div className={styles.relatedProducts}>
          {relatedProducts.map((product, index) => (
            <div key={index} className={styles.relatedProduct}>
              <div className={styles.relatedImage}>
                <img src="https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png" alt={product.name} />
              </div>
              <div className={styles.relatedName}>{product.name}</div>
              <div className={styles.relatedPrice}>{product.price}</div>
            </div>
          ))}
        </div>
      </section>

      <CustomerFooter />

      <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  )
}
