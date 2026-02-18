'use client'
import styles from './product.module.css'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { decryptData } from '@/lib/clientEncryption'
import Cart from '@/components/Cart'

export default function Product() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const productId = searchParams.get('id')
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

  useEffect(() => {
    setUser(getAuthUser())
    if (productId) {
      fetchProduct()
      fetchImages()
      fetchSpecs()
    }
  }, [productId])

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
  }

  const fetchImages = async () => {
    const res = await fetch(`/api/products/${productId}/images`)
    const data = await res.json()
    const imgs = data.images?.map((img: any) => img.imageUrl) || []
    setImages(imgs)
    setDefaultImages(imgs)
  }

  const fetchSpecs = async () => {
    const res = await fetch(`/api/products/${productId}/specs`)
    const data = await res.json()
    setSpecs(data || [])
  }

  const fetchSkuBySpecs = async () => {
    const variantKeys = Object.values(selectedSpecs).join(', ')
    const res = await fetch(`/api/products/${productId}/skus?variantKeys=${encodeURIComponent(variantKeys)}`)
    const data = await res.json()
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
  }

  const handleSpecSelection = (specName: string, attrName: string) => {
    setSelectedSpecs(prev => ({...prev, [specName]: attrName}))
  }

  if (!product) return <div>Loading...</div>

  const relatedProducts = [
    { name: 'Cashmere Crewneck', price: '$495' },
    { name: 'Tailored Wide-Leg Trousers', price: '$595' },
    { name: 'Silk Draped Blouse', price: '$425' },
    { name: 'Italian Leather Loafers', price: '$650' },
  ]

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>369</div>
        <nav className={styles.nav}>
          <Link href="/customer/shop" className={styles.navLink}>Gallery</Link>
          <Link href="/customer/category?type=men" className={styles.navLink}>Men</Link>
          <Link href="/customer/category?type=women" className={styles.navLink}>Women</Link>
        </nav>
        <div className={styles.icons}>
          <span className={styles.icon} onClick={() => setIsCartOpen(true)}>🛒</span>
          {user ? (
            <span className={styles.icon}>👤</span>
          ) : (
            <button className={styles.loginBtn} onClick={() => router.push('/signin')}>Login</button>
          )}
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.images}>
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
          <div className={styles.price}>LKR {selectedSku?.price || product.prodPrice}</div>
          <p className={styles.description}>{product.prodDescription}</p>
          {selectedSku && selectedSku.stock > 0 && <p style={{color: 'green', fontSize: '14px'}}>In Stock: {selectedSku.stock} available</p>}
          {selectedSku && selectedSku.stock === 0 && <p style={{color: 'red', fontSize: '14px'}}>Out of Stock</p>}

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

          <button className={styles.addBtn}>Add to Bag</button>
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

      <footer className={styles.footer}>
        <div className={styles.footerSection}>
          <h3>369</h3>
          <p>Everyday quiet luxury for the modern wardrobe.</p>
        </div>
        <div className={styles.footerSection}>
          <h3>Shop</h3>
          <div className={styles.footerLinks}>
            <a href="#" className={styles.footerLink}>New Arrivals</a>
            <a href="#" className={styles.footerLink}>Women</a>
            <a href="#" className={styles.footerLink}>Men</a>
            <a href="#" className={styles.footerLink}>Gallery</a>
          </div>
        </div>
        <div className={styles.footerSection}>
          <h3>Help</h3>
          <div className={styles.footerLinks}>
            <a href="#" className={styles.footerLink}>Customer Service</a>
            <a href="#" className={styles.footerLink}>Shipping & Returns</a>
            <a href="#" className={styles.footerLink}>Size Guide</a>
            <a href="#" className={styles.footerLink}>Contact Us</a>
          </div>
        </div>
        <div className={styles.footerSection}>
          <h3>Follow</h3>
          <div className={styles.footerLinks}>
            <a href="#" className={styles.footerLink}>Instagram</a>
            <a href="#" className={styles.footerLink}>Pinterest</a>
            <a href="#" className={styles.footerLink}>Journal</a>
          </div>
        </div>
      </footer>

      <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  )
}
