'use client'
import styles from './product.module.css'
import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getAuthUser } from '@/lib/clientAuth'
import { useClientAuthUser } from '@/lib/useClientAuthUser'
import { decryptData } from '@/lib/clientEncryption'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import { useAuditTrail } from '@/lib/useAuditTrail'
import { useEngagement } from '@/lib/engagement/tracker'
import { recordProductVisit } from '@/lib/engagement/session'
import Cart from '@/components/Cart'
import TryOnModal from '@/components/TryOnModal'
import { detectGarmentType } from '@/lib/garmentType'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'
import { PageSkeleton } from '@/components/Skeleton'
import Swal from 'sweetalert2'
import { Heart, Star, Sparkles } from 'lucide-react'
import { findSkuForSelection } from '@/lib/variants'
import { mutationJson } from '@/lib/clientRequests'
import { readGuestCart, withGuestCartLock } from '@/lib/guestCart'
import { selectionForSku, skuImageUrls } from '@/lib/productSeo'

function ProductContent({
  initialProduct = null,
  initialImages = [],
  initialSpecs = [],
  initialReviews = null,
  initialRelatedProducts = [],
  initialSkus = [],
  initialSkuId,
}: {
  initialProduct?: any
  initialImages?: string[]
  initialSpecs?: any[]
  initialReviews?: { reviews: any[]; averageRating: number; reviewCount: number } | null
  initialRelatedProducts?: any[]
  initialSkus?: any[]
  initialSkuId?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const productId = initialProduct?.id ? String(initialProduct.id) : searchParams.get('id')
  const { logActivity } = useAuditTrail()
  const engagement = useEngagement()
  const trackedProductRef = useRef<string | null>(null)
  const deepLinkedSku = initialSkus.find(sku => String(sku.id) === initialSkuId && selectionForSku(sku, initialSpecs) !== null) || null
  const [product, setProduct] = useState<any>(initialProduct)
  const [images, setImages] = useState<string[]>(skuImageUrls(deepLinkedSku, initialImages))
  const [defaultImages, setDefaultImages] = useState<string[]>(initialImages)
  const [specs, setSpecs] = useState<any[]>(initialSpecs)
  const [selectedSku, setSelectedSku] = useState<any>(deepLinkedSku)
  const [selectedSpecs, setSelectedSpecs] = useState<{[key: string]: string}>(selectionForSku(deepLinkedSku, initialSpecs) || {})
  const [relatedProducts, setRelatedProducts] = useState<any[]>(initialRelatedProducts)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [tryOnOpen, setTryOnOpen] = useState(false)
  const user = useClientAuthUser()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [reviews, setReviews] = useState<any[]>(initialReviews?.reviews || [])
  const [averageRating, setAverageRating] = useState(initialReviews?.averageRating || 0)
  const [reviewCount, setReviewCount] = useState(initialReviews?.reviewCount || 0)
  const [myRating, setMyRating] = useState(0)
  const [myComment, setMyComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const variantKey = JSON.stringify([productId, specs, selectedSpecs, defaultImages])
  const [previousVariantKey, setPreviousVariantKey] = useState(variantKey)
  const completeSelection = Boolean(productId && specs.length && specs.every(spec => selectedSpecs[spec.name]))
  if (previousVariantKey !== variantKey) {
    setPreviousVariantKey(variantKey)
    setSelectedSku(null)
    setImages(defaultImages)
    setIsTransitioning(completeSelection)
  }

  // One product_view per visit (not per re-render or auth hydration), counted per
  // product so opening product A then B is not mistaken for a repeat view of B.
  useEffect(() => {
    if (!productId || !engagement || trackedProductRef.current === productId) return
    const pid = parseInt(productId)
    if (!Number.isFinite(pid)) return
    trackedProductRef.current = productId
    const visits = recordProductVisit(pid)
    engagement.track({ eventType: 'product_view', productId: pid, pageType: 'product', metadata: { count: visits } })
    if (visits >= 2) {
      window.dispatchEvent(new CustomEvent('engagement:trigger', { detail: { type: 'repeat_view', productId: pid } }))
    }
  }, [productId, engagement])

  // Tell the shopping assistant which product this page is about (slug URLs carry no id).
  useEffect(() => {
    const pid = productId ? parseInt(productId) : NaN
    if (!engagement || !Number.isFinite(pid)) return
    engagement.setPageContext({
      productId: pid,
      productName: product?.prodName ?? null,
      categoryId: Number.isInteger(product?.categoryId) ? product.categoryId : null,
      categoryName: product?.prodCategoryName ?? null,
    })
  }, [productId, product?.prodName, product?.categoryId, product?.prodCategoryName, engagement])

  useEffect(() => {
    if (!productId) return
    const hasInitial = initialProduct && String(initialProduct.id) === String(productId)
    if (hasInitial) {
      if (product?.prodName) {
        logActivity('VIEW_PRODUCT', 'product', productId, {
          productName: product.prodName,
          category: product.prodCategoryName,
          price: product.prodPrice,
        })
      }
      if (user) checkWishlist()
      // Related/reviews/images/specs already provided when initial; refetch reviews on demand via submit
      return
    }
    loadProductData()
    if (user) checkWishlist()
    fetchReviews()
  }, [productId, user])

  async function loadProductData() {
    await Promise.all([
      fetchProduct(),
      fetchImages(),
      fetchSpecs()
    ])
  }

  useEffect(() => {
    const controller = new AbortController()
    if (specs.length === 0 && deepLinkedSku) return () => controller.abort()
    if (!productId || specs.length === 0 || !specs.every(spec => selectedSpecs[spec.name])) {
      return () => controller.abort()
    }
    const load = async () => {
      try {
        const res = await fetch(`/api/products/${productId}/skus`, { signal: controller.signal })
        if (!res.ok) throw new Error('Variant lookup failed')
        const result = await res.json()
        const data = decryptData(result.data)
        if (controller.signal.aborted) return
        const sku = findSkuForSelection(Array.isArray(data) ? data : [], specs, selectedSpecs)
        setSelectedSku(sku)
        if (Array.isArray(data) && data.length > 0 && (!sku || Number(sku.stock) <= 0)) {
          window.dispatchEvent(new CustomEvent('engagement:trigger', { detail: { type: 'unavailable', productId: Number(productId) } }))
        }
        if (sku?.images) {
          try {
            const urls = JSON.parse(sku.images)
            if (Array.isArray(urls) && urls.length && urls.every(url => typeof url === 'string')) setImages(urls)
          } catch { /* Retain product images for malformed legacy SKU images. */ }
        }
      } catch {
        if (!controller.signal.aborted) setSelectedSku(null)
      } finally {
        if (!controller.signal.aborted) setIsTransitioning(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [selectedSpecs, specs, productId, defaultImages])

  async function fetchProduct() {
    const res = await fetch(`/api/products/${productId}`)
    const result = await res.json()
    const decrypted = decryptData(result.data)
    setProduct(decrypted)
    logActivity('VIEW_PRODUCT', 'product', productId!, { 
      productName: decrypted.prodName, 
      category: decrypted.prodCategoryName,
      price: decrypted.prodPrice 
    })
    if (decrypted.prodCategoryName) {
      fetchRelatedProducts(decrypted.prodCategoryName)
    }
  }

  async function fetchRelatedProducts(categoryName: string) {
    try {
      const res = await fetch(`/api/products/category/${encodeURIComponent(categoryName)}?sort=newest&limit=4`)
      const result = await res.json()
      const decrypted = decryptData(result.data)
      const products = (decrypted.products || [])
        .filter((p: any) => p.id !== parseInt(productId!))
        .slice(0, 4)
      setRelatedProducts(products)
    } catch (error) {
      setRelatedProducts([])
    }
  }

  async function fetchImages() {
    const res = await fetch(`/api/products/${productId}/images`)
    const result = await res.json()
    const imgs = decryptData(result.data)
    const imageUrls = imgs?.map((img: any) => img.imageUrl) || []
    setImages(imageUrls)
    setDefaultImages(imageUrls)
  }

  async function fetchSpecs() {
    const res = await fetch(`/api/products/${productId}/specs`)
    const result = await res.json()
    const specs = decryptData(result.data)
    setSpecs(specs || [])
  }

  async function fetchReviews() {
    if (!productId) return
    try {
      const res = await fetch(`/api/products/${productId}/reviews`)
      const result = await res.json()
      const data = decryptData(result.data)
      setReviews(data.reviews || [])
      setAverageRating(data.averageRating || 0)
      setReviewCount(data.reviewCount || 0)
    } catch (error) {
      console.error('Failed to fetch reviews:', error)
    }
  }

  const submitReview = async () => {
    if (myRating === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Select a Rating',
        text: 'Please select a star rating before submitting',
        confirmButtonColor: '#000'
      })
      return
    }

    const authUser = getAuthUser()
    if (!authUser) {
      sessionStorage.setItem('redirectAfterLogin', `/customer/product?id=${(product as any)?.slug || productId}`)
      router.push('/signin')
      return
    }

    setSubmittingReview(true)
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rating: myRating, comment: myComment.trim() || undefined })
      })

      if (res.ok) {
        setMyRating(0)
        setMyComment('')
        await fetchReviews()
        Swal.fire({
          icon: 'success',
          title: 'Review Submitted!',
          text: 'Thank you for your feedback',
          confirmButtonColor: '#000',
          timer: 2000
        })
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit review')
      }
    } catch (error: any) {
      console.error('Submit review error:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to submit review',
        confirmButtonColor: '#000'
      })
    } finally {
      setSubmittingReview(false)
    }
  }

  const formatReviewDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const renderStars = (rating: number, size = 16) => {
    return (
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            className={star <= Math.round(rating) ? styles.starFilled : styles.starEmpty}
            fill={star <= Math.round(rating) ? 'currentColor' : 'none'}
          />
        ))}
      </div>
    )
  }

  const handleSpecSelection = (specName: string, attrName: string) => {
    setSelectedSku(null)
    setIsTransitioning(true)
    setSelectedSpecs(prev => ({...prev, [specName]: attrName}))
    logActivity('SELECT_SPEC', 'product', productId!, { specName, attrName })
    const pid = productId ? parseInt(productId) : null
    engagement?.track({ eventType: /color/i.test(specName) ? 'color_select' : 'size_select', productId: Number.isFinite(pid as any) ? pid : null, metadata: { specName, attrName } })
  }

  async function checkWishlist() {
    const authUser = getAuthUser()
    if (!authUser || !productId) {
      setIsWishlisted(false)
      return
    }
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/wishlist', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      const data = decryptData(result.data)
      const found = (data.wishlist || []).some((item: any) => item.productId === parseInt(productId!))
      setIsWishlisted(found)
    } catch (error) {
      setIsWishlisted(false)
    }
  }

  const toggleWishlist = async () => {
    const authUser = getAuthUser()
    if (!authUser) {
      sessionStorage.setItem('redirectAfterLogin', `/customer/product?id=${(product as any)?.slug || productId}`)
      router.push('/signin')
      return
    }

    try {
      const token = localStorage.getItem('authToken')
      if (isWishlisted) {
        await fetch(`/api/wishlist?productId=${productId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
        setIsWishlisted(false)
        Swal.fire({
          icon: 'success',
          title: 'Removed from Wishlist',
          confirmButtonColor: '#000',
          timer: 1500
        })
      } else {
        await fetch('/api/wishlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ productId: parseInt(productId!) })
        })
        setIsWishlisted(true)
        const pid = productId ? parseInt(productId) : null
        engagement?.track({ eventType: 'wishlist_add', productId: Number.isFinite(pid as any) ? pid : null })
        Swal.fire({
          icon: 'success',
          title: 'Added to Wishlist',
          confirmButtonColor: '#000',
          timer: 1500
        })
      }
      window.dispatchEvent(new Event('wishlistUpdated'))
    } catch (error) {
      console.error('Failed to update wishlist:', error)
    }
  }

  if (!product) return null

  const displayPrice = selectedSku ? (selectedSku.salePrice ?? selectedSku.price) : (product.salePrice ?? product.prodPrice)
  const displayOriginal = selectedSku ? (selectedSku.originalPrice ?? selectedSku.price) : (product.originalPrice ?? product.prodPrice)
  const isOnSale = Number(displayPrice) < Number(displayOriginal)
  const discountPercent = isOnSale ? Math.round(((Number(displayOriginal) - Number(displayPrice)) / Number(displayOriginal)) * 100) : 0

  const tryOnGarmentUrl = (() => {
    if (selectedSku?.images) {
      try {
        const skuImages = JSON.parse(selectedSku.images)
        if (Array.isArray(skuImages) && skuImages.length > 0) return skuImages[0]
      } catch {}
    }
    return images.length > 0 ? images[0] : (product?.prodImg || '')
  })()

  const tryOnSkuName = selectedSku ? Object.values(selectedSpecs).join(' / ') : undefined

  return (
    <div className={styles.container}>
      <CustomerHeader user={user} onCartOpen={() => setIsCartOpen(true)} />

      <main id="main-content">
      <nav aria-label="Breadcrumb" style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 16px 0', fontSize: 14 }}>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <li><Link href="/">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/customer/shop">Shop</Link></li>
          {product?.prodCategoryName ? (
            <>
              <li aria-hidden="true">/</li>
              <li><Link href={`/customer/category?type=${encodeURIComponent(String(product.prodCategoryName).toLowerCase())}`}>{product.prodCategoryName}</Link></li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: '#666' }}>{product.prodName}</li>
        </ol>
      </nav>

      <div className={styles.content}>
        <div className={`${styles.images} ${isTransitioning ? styles.fadeOut : styles.fadeIn}`}>
          {images.length > 0 ? images.map((img, index) => (
            <div key={index} className={styles.imageBox} onClick={() => engagement?.track({ eventType: 'image_interaction', productId: productId ? parseInt(productId) : null, metadata: { index } })}>
              <img src={getOptimizedImageUrl(img)} alt={`${product.prodName} — image ${index + 1}`} />
            </div>
          )) : (
            <div className={styles.imageBox}>
              <img src={getOptimizedImageUrl(product.prodImg) || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt={product.prodName} />
            </div>
          )}
        </div>

        <div className={styles.details}>
          <h1 className={styles.title}>{product.prodName}</h1>
          <div className={`${styles.priceRow} ${isTransitioning ? styles.fadeOut : styles.fadeIn}`}>
            <div className={`${styles.price} ${isOnSale ? styles.salePrice : ''}`}>LKR {Number(displayPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            {isOnSale && <div className={styles.originalPrice}>LKR {Number(displayOriginal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
            {isOnSale && <span className={styles.discountBadge}>{discountPercent}% OFF</span>}
          </div>
          {isOnSale && !selectedSku && (
            <p className={styles.discountHint}>{product.discountName ? `${product.discountName} applied` : 'Discount applied'}</p>
          )}
          <p className={styles.description}>{product.prodDescription}</p>
          {!product.stockStatus && <p className={`${styles.stockInfo} ${styles.outOfStock}`}>Currently out of stock</p>}
          {selectedSku && selectedSku.stock > 0 && <p className={`${styles.stockInfo} ${isTransitioning ? styles.fadeOut : styles.fadeIn}`}>In Stock: {selectedSku.stock} available</p>}
          {selectedSku && selectedSku.stock === 0 && <p className={`${styles.stockInfo} ${styles.outOfStock} ${isTransitioning ? styles.fadeOut : styles.fadeIn}`}>Out of Stock</p>}

          {specs.map((spec, index) => (
            <div key={index} className={styles.option} id={index === 0 ? 'product-options' : undefined}
              data-assist="spec" data-assist-name={spec.name} data-assist-selected={selectedSpecs[spec.name] ? 'true' : 'false'}>
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
                      aria-label={`${spec.name}: ${attr.name}`}
                      aria-pressed={isSelected}
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

          <div className={styles.wishlistRow}>
            <button
              className={`${styles.wishlistBtn} ${isWishlisted ? styles.active : ''}`}
              id="product-wishlist"
              data-assist-active={isWishlisted ? 'true' : 'false'}
              onClick={toggleWishlist}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
            <button id="product-add-to-bag" className={styles.addBtn} disabled={isAddingToCart || isTransitioning} onClick={async () => {
              if (isAddingToCart || isTransitioning) return
              setIsAddingToCart(true)

              try {
                if (specs.length > 0 && Object.keys(selectedSpecs).length !== specs.length) {
                  Swal.fire({
                    icon: 'warning',
                    title: 'Missing Selection',
                    text: 'Please select all product options',
                    confirmButtonColor: '#000'
                  })
                  return
                }

                if (specs.length > 0 && !selectedSku) {
                  Swal.fire({
                    icon: 'error',
                    title: 'Not Available',
                    text: 'Selected variant is not available',
                    confirmButtonColor: '#000'
                  })
                  return
                }

                if (!product.stockStatus || (selectedSku && selectedSku.stock <= 0)) {
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
                  price: Number(displayPrice),
                  originalPrice: Number(displayOriginal),
                  name: product.prodName,
                  image: tryOnGarmentUrl
                }

                if (user) {
                  const token = localStorage.getItem('authToken')
                  await mutationJson(await fetch('/api/cart', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(cartItem)
                  }))
                  window.dispatchEvent(new Event('cartUpdated'))
                  Swal.fire({
                    icon: 'success',
                    title: 'Added to Cart!',
                    text: 'Product has been added to your cart',
                    confirmButtonColor: '#000',
                    timer: 2000
                  })
                } else {
                  await withGuestCartLock(() => {
                    const cart = readGuestCart(localStorage)
                    cart.push(cartItem)
                    localStorage.setItem('cart', JSON.stringify(cart))
                  })
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
                const pid = productId ? parseInt(productId) : null
                engagement?.track({ eventType: 'cart_add', productId: Number.isFinite(pid as any) ? pid : null, metadata: { skuId: selectedSku?.id || null } })
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
          </div>
          {user && selectedSku && tryOnGarmentUrl && (
            <button
              className={styles.tryonBtn}
              id="product-try-on"
              onClick={() => setTryOnOpen(true)}
            >
              <Sparkles size={18} /> Try It Out
            </button>
          )}
          <p className={styles.shipping}>Shipping fee calculated at checkout</p>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className={styles.related}>
          <h2 className={styles.relatedTitle}>You Also Might Like</h2>
          <div className={styles.relatedProducts}>
            {relatedProducts.map((related) => {
              const relSale = related.isOnSale === true && Number(related.salePrice) < Number(related.prodPrice)
              const href = `/customer/product?id=${(related as any).slug || related.id}`
              return (
                <Link key={related.id} href={href} className={styles.relatedProduct}>
                  <div className={styles.relatedImage}>
                    {relSale && <span className={styles.discountBadge}>{related.discountPercent}% OFF</span>}
                    <img src={getOptimizedImageUrl(related.prodImg) || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt={related.prodName} />
                  </div>
                  <div className={styles.relatedName}>{related.prodName}</div>
                  <div className={styles.relatedPriceRow}>
                    <span className={relSale ? styles.relatedSalePrice : ''}>LKR {Number(related.salePrice ?? related.prodPrice).toLocaleString()}</span>
                    {relSale && <span className={styles.originalPrice}>LKR {Number(related.originalPrice).toLocaleString()}</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section className={styles.reviews} id="product-reviews" data-assist-count={reviewCount}>
        <h2 className={styles.reviewsTitle}>Customer Reviews</h2>

        <div className={styles.reviewsSummary}>
          <div className={styles.reviewsScore}>{averageRating}</div>
          <div className={styles.reviewsMeta}>
            {renderStars(averageRating, 20)}
            <span>{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</span>
          </div>
        </div>

        {reviews.length === 0 ? (
          <p className={styles.reviewsEmpty}>No reviews yet. Be the first to review this product.</p>
        ) : (
          <div className={styles.reviewsList}>
            {reviews.map((review) => (
              <div key={review.id} className={styles.reviewItem}>
                <div className={styles.reviewHeader}>
                  <span className={styles.reviewAuthor}>{review.authorName}</span>
                  <span className={styles.reviewDate}>{formatReviewDate(review.createdAt)}</span>
                </div>
                {renderStars(review.rating)}
                {review.comment && <p className={styles.reviewComment}>{review.comment}</p>}
              </div>
            ))}
          </div>
        )}

        <div className={styles.reviewForm}>
          <h3 className={styles.reviewFormTitle}>Write a Review</h3>
          <div className={styles.reviewFormStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`${styles.starBtn} ${star <= myRating ? styles.starSelected : ''}`}
                onClick={() => setMyRating(star)}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
              >
                <Star size={24} fill={star <= myRating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <textarea
            className={styles.reviewInput}
            placeholder="Share your thoughts about this product (optional)"
            value={myComment}
            onChange={(e) => setMyComment(e.target.value)}
            rows={4}
          />
          <button
            className={styles.reviewSubmit}
            onClick={submitReview}
            disabled={submittingReview}
          >
            {submittingReview ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </section>
      </main>

      <CustomerFooter />

      <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      <TryOnModal
        open={tryOnOpen}
        onClose={() => setTryOnOpen(false)}
        garmentUrl={tryOnGarmentUrl}
        productName={product?.prodName || ''}
        skuName={tryOnSkuName}
      />
    </div>
  )
}

export default function Product({
  initialProduct = null,
  initialImages = [],
  initialSpecs = [],
  initialReviews = null,
  initialRelatedProducts = [],
  initialSkus = [],
  initialSkuId,
}: {
  initialProduct?: any
  initialImages?: string[]
  initialSpecs?: any[]
  initialReviews?: { reviews: any[]; averageRating: number; reviewCount: number } | null
  initialRelatedProducts?: any[]
  initialSkus?: any[]
  initialSkuId?: string
}) {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <ProductContent
        key={`${initialProduct?.id ?? 'unresolved'}:${initialSkuId ?? 'base'}`}
        initialProduct={initialProduct}
        initialImages={initialImages}
        initialSpecs={initialSpecs}
        initialReviews={initialReviews}
        initialRelatedProducts={initialRelatedProducts}
        initialSkus={initialSkus}
        initialSkuId={initialSkuId}
      />
    </Suspense>
  )
}
