'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../account.module.css'
import { decryptData } from '@/lib/clientEncryption'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import { CardsSkeleton } from '@/components/Skeleton'
import Swal from 'sweetalert2'

const FALLBACK_IMG = "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"

export default function WishlistPage() {
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWishlist()
  }, [])

  const fetchWishlist = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/wishlist', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      const data = decryptData(result.data)
      setItems(data.wishlist || [])
    } catch (error) {
      console.error('Failed to fetch wishlist:', error)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (index: number) => {
    const item = items[index]
    const result = await Swal.fire({
      title: 'Remove from Wishlist?',
      text: `Remove "${item.product?.prodName || 'this item'}" from your wishlist?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#000',
      cancelButtonColor: '#999',
      confirmButtonText: 'Yes, remove',
      cancelButtonText: 'Cancel'
    })

    if (!result.isConfirmed) return

    try {
      const token = localStorage.getItem('authToken')
      const skuId = item.skuId || item.sku?.id
      const url = `/api/wishlist?productId=${item.productId}${skuId ? `&skuId=${skuId}` : ''}`
      await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const updated = items.filter((_, i) => i !== index)
      setItems(updated)
      window.dispatchEvent(new Event('wishlistUpdated'))
    } catch (error) {
      console.error('Failed to remove item:', error)
    }
  }

  const getItemImage = (item: any) => {
    if (item.sku?.images) {
      try {
        const imgs = JSON.parse(item.sku.images)
        if (imgs.length > 0) return imgs[0]
      } catch {
        // ignore
      }
    }
    return item.product?.prodImg
  }

  return (
    <div className={styles.orderHistory}>
      <h1>My Wishlist</h1>
      <p>Items you&apos;ve saved for later</p>

      {loading ? (
        <CardsSkeleton count={3} />
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>Your wishlist is empty</p>
          <p style={{ fontSize: '14px', margin: 0 }}>Browse the shop and save items you love</p>
          <button
            className={styles.wishlistBtn}
            onClick={() => router.push('/customer/shop')}
            style={{ marginTop: '20px' }}
          >
            Browse Products
          </button>
        </div>
      ) : (
        <div className={styles.wishlistGrid}>
          {items.map((item, index) => {
            const isOnSale = item.isOnSale === true && Number(item.salePrice) < Number(item.originalPrice)
            return (
              <div key={item.id} className={styles.wishlistItem}>
                <div className={styles.wishlistImage}>
                  {isOnSale && <span className={styles.wishlistSaleBadge}>{item.discountPercent}% OFF</span>}
                  <img
                    src={getOptimizedImageUrl(getItemImage(item)) || FALLBACK_IMG}
                    alt={item.product?.prodName || 'Product'}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className={styles.wishlistInfo}>
                  <div
                    className={styles.wishlistName}
                    onClick={() => router.push(`/customer/product?id=${item.productId}`)}
                  >
                    {item.product?.prodName}
                  </div>
                  <div className={styles.wishlistPrice}>
                    <span className={isOnSale ? styles.wishlistSalePrice : ''}>LKR {Number(item.salePrice ?? item.product?.prodPrice).toLocaleString()}</span>
                    {isOnSale && <span className={styles.wishlistOriginalPrice}>LKR {Number(item.originalPrice).toLocaleString()}</span>}
                  </div>
                </div>
                <div className={styles.wishlistActions}>
                  <button
                    className={styles.wishlistBtn}
                    onClick={() => router.push(`/customer/product?id=${item.productId}`)}
                  >
                    View Product
                  </button>
                  <button className={styles.wishlistRemove} onClick={() => handleRemove(index)}>
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
