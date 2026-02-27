'use client'
import styles from './Cart.module.css'
import { useState, useEffect } from 'react'
import { getAuthUser } from '@/lib/auth'
import { decryptData } from '@/lib/clientEncryption'
import { useRouter } from 'next/navigation'
import Swal from 'sweetalert2'

interface CartProps {
  isOpen: boolean
  onClose: () => void
}

export default function Cart({ isOpen, onClose }: CartProps) {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [shippingFee, setShippingFee] = useState(0)
  const [shippingType, setShippingType] = useState('Standard')

  useEffect(() => {
    setUser(getAuthUser())
    if (isOpen) {
      loadCart()
      loadShippingFee()
    }
  }, [isOpen])

  const loadCart = async () => {
    const authUser = getAuthUser()
    if (authUser) {
      // Load from backend
      try {
        const token = localStorage.getItem('authToken')
        const res = await fetch('/api/cart', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const result = await res.json()
        const data = decryptData(result.data)
        console.log('Raw cart items from DB:', data.cartItems)
        await enrichCartItems(data.cartItems || [])
      } catch (error) {
        console.error('Failed to load cart:', error)
      }
    } else {
      // Load from localStorage
      const cart = JSON.parse(localStorage.getItem('cart') || '[]')
      setCartItems(cart)
    }
  }

  const enrichCartItems = async (items: any[]) => {
    console.log('Enriching items:', items)
    const enriched = await Promise.all(items.map(async (item) => {
      try {
        const res = await fetch(`/api/products/${item.productId}`)
        const result = await res.json()
        const product = decryptData(result.data)
        console.log('Product data:', product)
        
        const specs = typeof item.specs === 'string' ? JSON.parse(item.specs) : item.specs
        
        let image = product.prodImg
        let price = product.prodPrice
        
        if (item.skuId) {
          try {
            const skuRes = await fetch(`/api/products/${item.productId}/skus`)
            const skuResult = await skuRes.json()
            const skus = decryptData(skuResult.data)
            const sku = skus.find((s: any) => s.id === item.skuId)
            console.log('Found SKU:', sku)
            
            if (sku) {
              price = sku.price
              if (sku.images) {
                const skuImages = JSON.parse(sku.images)
                if (skuImages.length > 0) {
                  image = skuImages[0]
                }
              }
            }
          } catch (error) {
            console.error('Failed to fetch SKU details:', error)
          }
        }
        
        const enrichedItem = {
          ...item,
          name: product.prodName,
          image: image,
          price: price,
          specs: specs
        }
        console.log('Enriched item:', enrichedItem)
        return enrichedItem
      } catch (error) {
        console.error('Failed to enrich cart item:', error)
        return item
      }
    }))
    console.log('All enriched items:', enriched)
    setCartItems(enriched)
  }

  const loadShippingFee = async () => {
    try {
      const res = await fetch('/api/shipping')
      const result = await res.json()
      if (result.data) {
        const decrypted = decryptData(result.data)
        setShippingFee(Number(decrypted.value))
        setShippingType(decrypted.type)
      }
    } catch (error) {
      console.error('Failed to load shipping fee:', error)
    }
  }

  const removeItem = async (index: number) => {
    const result = await Swal.fire({
      title: 'Remove Item?',
      text: 'Are you sure you want to remove this item from your cart?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#000',
      cancelButtonColor: '#999',
      confirmButtonText: 'Yes, remove it',
      cancelButtonText: 'Cancel'
    })

    if (!result.isConfirmed) return

    if (user) {
      // Remove from backend
      const item = cartItems[index]
      const token = localStorage.getItem('authToken')
      await fetch(`/api/cart/${item.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
    } else {
      // Remove from localStorage
      const cart = JSON.parse(localStorage.getItem('cart') || '[]')
      cart.splice(index, 1)
      localStorage.setItem('cart', JSON.stringify(cart))
    }
    loadCart()
    window.dispatchEvent(new Event('cartUpdated'))
  }

  if (!isOpen) return null

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  
  // Calculate shipping fee based on type
  const calculatedShippingFee = shippingType.toLowerCase() === 'percentage' 
    ? (subtotal * shippingFee) / 100 
    : shippingFee
  
  const total = subtotal + calculatedShippingFee

  return (
    <>
      <div className={styles.overlay} onClick={onClose}></div>
      <div className={styles.cart}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Shopping Bag</h2>
            <p className={styles.itemCount}>{cartItems.length} items</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.items}>
          {cartItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <p>Your cart is empty</p>
            </div>
          ) : (
            cartItems.map((item, index) => (
              <div key={index} className={styles.item}>
                <div className={styles.itemImage}>
                  <img src={item.image || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt={item.name} />
                </div>
                <div className={styles.itemDetails}>
                  <h3 className={styles.itemName}>{item.name}</h3>
                  <p className={styles.itemVariant}>{item.specs ? Object.values(item.specs).join(' / ') : ''}</p>
                  <p className={styles.itemPrice}>LKR {item.price}</p>
                  <div className={styles.itemActions}>
                    <div className={styles.quantity}>
                      <span>{item.quantity}</span>
                    </div>
                    <button className={styles.removeBtn} onClick={() => removeItem(index)}>Remove</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryRow}>
            <span>Subtotal</span>
            <span>LKR {subtotal.toLocaleString()}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Shipping ({shippingType === 'percentage' ? `${shippingFee}%` : shippingType})</span>
            <span>LKR {calculatedShippingFee.toLocaleString()}</span>
          </div>
          <div className={styles.totalRow}>
            <span>Total</span>
            <span className={styles.totalAmount}>LKR {total.toLocaleString()}</span>
          </div>
          <button className={styles.checkoutBtn} onClick={async () => {
            const authUser = getAuthUser()
            if (!authUser) {
              // Save intended destination
              sessionStorage.setItem('redirectAfterLogin', '/customer/cart')
              router.push('/signin')
            } else {
              router.push('/customer/cart')
            }
          }}>Proceed to Checkout</button>
          <p className={styles.taxNote}>Taxes calculated at checkout</p>
        </div>
      </div>
    </>
  )
}
