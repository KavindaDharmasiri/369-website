'use client'
import styles from './product.module.css'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAuthUser } from '@/lib/clientAuth'
import { decryptData } from '@/lib/clientEncryption'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import { useAuditTrail } from '@/lib/useAuditTrail'
import Cart from '@/components/Cart'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'
import { PageSkeleton } from '@/components/Skeleton'
import Swal from 'sweetalert2'
import { Heart, Star } from 'lucide-react'

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
  const [relatedProducts, setRelatedProducts] = useState<any[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [reviews, setReviews] = useState<any[]>([])
  const [averageRating, setAverageRating] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [myRating, setMyRating] = useState(0)
  const [myComment, setMyComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  useEffect(() => {
    setUser(getAuthUser())
    if (productId) {
      loadProductData()
      checkWishlist()
      fetchReviews()
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
    if (decrypted.prodCategoryName) {
      fetchRelatedProducts(decrypted.prodCategoryName)
    }
  }

  const fetchRelatedProducts = async (categoryName: string) => {
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

  const fetchReviews = async () => {
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
      sessionStorage.setItem('redirectAfterLogin', `/customer/product?id=${productId}`)
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
    setSelectedSpecs(prev => ({...prev, [specName]: attrName}))
    logActivity('SELECT_SPEC', 'product', productId!, { specName, attrName })
  }

  const checkWishlist = async () => {
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
      sessionStorage.setItem('redirectAfterLogin', `/customer/product?id=${productId}`)
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

  return (
    <div className={styles.container}>
      <CustomerHeader user={user} onCartOpen={() => setIsCartOpen(true)} />

      <div className={styles.content}>
        <div className={`${styles.images} ${isTransitioning ? styles.fadeOut : styles.fadeIn}`}>
          {images.length > 0 ? images.map((img, index) => (
            <div key={index} className={styles.imageBox}>
              <img src={getOptimizedImageUrl(img)} alt={`Product ${index + 1}`} />
            </div>
          )) : (
            <div className={styles.imageBox}>
              <img src={getOptimizedImageUrl(product.prodImg) || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt="Product" />
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

          <div className={styles.wishlistRow}>
            <button
              className={`${styles.wishlistBtn} ${isWishlisted ? styles.active : ''}`}
              onClick={toggleWishlist}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
            <button className={styles.addBtn} onClick={async () => {
              if (isAddingToCart) return
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
                  price: Number(displayPrice),
                  originalPrice: Number(displayOriginal),
                  name: product.prodName,
                  image: selectedSku?.images ? JSON.parse(selectedSku.images)[0] : (images.length > 0 ? images[0] : product.prodImg)
                }

                if (user) {
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
          </div>
          <p className={styles.shipping}>Shipping fee calculated at checkout</p>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className={styles.related}>
          <h2 className={styles.relatedTitle}>You Also Might Like</h2>
          <div className={styles.relatedProducts}>
            {relatedProducts.map((related) => {
              const relSale = related.isOnSale === true && Number(related.salePrice) < Number(related.prodPrice)
              return (
                <div key={related.id} className={styles.relatedProduct} onClick={() => router.push(`/customer/product?id=${related.id}`)}>
                  <div className={styles.relatedImage}>
                    {relSale && <span className={styles.discountBadge}>{related.discountPercent}% OFF</span>}
                    <img src={getOptimizedImageUrl(related.prodImg) || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt={related.prodName} />
                  </div>
                  <div className={styles.relatedName}>{related.prodName}</div>
                  <div className={styles.relatedPriceRow}>
                    <span className={relSale ? styles.relatedSalePrice : ''}>LKR {Number(related.salePrice ?? related.prodPrice).toLocaleString()}</span>
                    {relSale && <span className={styles.originalPrice}>LKR {Number(related.originalPrice).toLocaleString()}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className={styles.reviews}>
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

      <CustomerFooter />

      <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  )
}

export default function Product() {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <ProductContent />
    </Suspense>
  )
}
