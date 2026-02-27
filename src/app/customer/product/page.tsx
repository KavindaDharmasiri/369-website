'use client'
import styles from './product.module.css'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { decryptData } from '@/lib/clientEncryption'
import { useAuditTrail } from '@/lib/useAuditTrail'
import Cart from '@/components/Cart'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'
import Swal from 'sweetalert2'

function ProductContent() {
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
  const [isAddingToCart, setIsAddingToCart] = useState(false)

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
    logActivity('VIEW_PRODUCT', 'product', productId!, { 
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
    const result = await res.json()
    const data = decryptData(result.data)
    
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
    logActivity('SELECT_SPEC', 'product', productId!, { specName, attrName })
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
                {spec.attributes.map((attr: any, i: number) => {
                  const isColor = attr.type === 'color'
                  const isSelected = selectedSpecs[spec.name] === attr.name
                  return (
                    <button 
                      key={i} 
                      className={`${styles.sizeBtn} ${isColor ? styles.colorBtn : ''} ${isSelected ? styles.selected : ''}`}
                      onClick={() => handleSpecSelection(spec.name, attr.name)}
                      style={isColor ? { 
                        backgroundColor: attr.value, 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: '50%', 
                        padding: 0,
                        border: isSelected ? '2px solid #000' : '2px solid #ddd',
                        boxShadow: isSelected ? '0 0 0 2px #fff, 0 0 0 4px #000' : '0 2px 4px rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      } : {}}
                      title={attr.name}
                      onMouseEnter={(e) => {
                        if (isColor && !isSelected) {
                          e.currentTarget.style.transform = 'scale(1.1)'
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isColor && !isSelected) {
                          e.currentTarget.style.transform = 'scale(1)'
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                        }
                      }}
                    >
                      {!isColor && attr.value}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <button className={styles.addBtn} onClick={async () => {
            if (isAddingToCart) return
            setIsAddingToCart(true)
            
            try {
              // Validate specifications are selected
              if (specs.length > 0 && Object.keys(selectedSpecs).length !== specs.length) {
                Swal.fire({
                  icon: 'warning',
                  title: 'Missing Selection',
                  text: 'Please select all product options',
                  confirmButtonColor: '#000'
                })
                return
              }

              // Validate SKU availability
              if (specs.length > 0 && !selectedSku) {
                Swal.fire({
                  icon: 'error',
                  title: 'Not Available',
                  text: 'Selected variant is not available',
                  confirmButtonColor: '#000'
                })
                return
              }

              // Check stock
              if (selectedSku && selectedSku.stock === 0) {
                Swal.fire({
                  icon: 'error',
                  title: 'Out of Stock',
                  text: 'This product is currently out of stock',
                  confirmButtonColor: '#000'
                })
                return
              }

              const cartItem = {
                productId: parseInt(productId!),
                skuId: selectedSku?.id || null,
                quantity: 1,
                specs: selectedSpecs,
                price: selectedSku?.price || product.prodPrice,
                name: product.prodName,
                image: selectedSku?.images ? JSON.parse(selectedSku.images)[0] : (images.length > 0 ? images[0] : product.prodImg)
              }

              if (user) {
                // Logged in - save to backend
                const token = localStorage.getItem('authToken')
                await fetch('/api/cart', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify(cartItem)
                })
                window.dispatchEvent(new Event('cartUpdated'))
                Swal.fire({
                  icon: 'success',
                  title: 'Added to Cart!',
                  text: 'Product has been added to your cart',
                  confirmButtonColor: '#000',
                  timer: 2000
                })
              } else {
                // Not logged in - save to localStorage
                const cart = JSON.parse(localStorage.getItem('cart') || '[]')
                cart.push(cartItem)
                localStorage.setItem('cart', JSON.stringify(cart))
                window.dispatchEvent(new Event('cartUpdated'))
                Swal.fire({
                  icon: 'success',
                  title: 'Added to Cart!',
                  text: 'Product has been added to your cart',
                  confirmButtonColor: '#000',
                  timer: 2000
                })
              }

              logActivity('ADD_TO_CART', 'product', productId!, { 
                price: selectedSku?.price || product.prodPrice,
                specs: selectedSpecs 
              })
            } catch (error) {
              console.error('Failed to add to cart:', error)
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to add to cart',
                confirmButtonColor: '#000'
              })
            } finally {
              setTimeout(() => setIsAddingToCart(false), 1000)
            }
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

export default function Product() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProductContent />
    </Suspense>
  )
}
