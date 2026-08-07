'use client'
import styles from './Cart.module.css'
import { useState, useEffect } from 'react'
import { getAuthUser } from '@/lib/clientAuth'
import { decryptData } from '@/lib/clientEncryption'
import { enrichServerCartItem, enrichGuestCartItem } from '@/lib/cartEnrich'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import { computeTax } from '@/lib/pricing'
import { useRouter } from 'next/navigation'
import { X, Minus, Plus } from 'lucide-react'
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
  const [taxSettings, setTaxSettings] = useState({ taxMode: 'percentage', taxRate: 8 })

  useEffect(() => {
    setUser(getAuthUser())
    if (isOpen) {
      loadCart()
      loadShippingFee()
      loadTaxSettings()
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
        setCartItems((data.cartItems || []).map(enrichServerCartItem))
      } catch (error) {
        console.error('Failed to load cart:', error)
      }
    } else {
      // Load from localStorage
      const cart = JSON.parse(localStorage.getItem('cart') || '[]')
      setCartItems(await Promise.all(cart.map(enrichGuestCartItem)))
    }
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

  const loadTaxSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const result = await res.json()
      if (result.data) {
        const settings = decryptData(result.data)
        setTaxSettings({ taxMode: settings.taxMode || 'percentage', taxRate: Number(settings.taxRate) || 0 })
      }
    } catch (error) {
      console.error('Failed to load tax settings:', error)
    }
  }

  const updateQuantity = async (index: number, newQuantity: number) => {
    const item = cartItems[index]
    if (newQuantity < 1) return

    if (item.stock != null && newQuantity > item.stock) {
      Swal.fire({
        icon: 'warning',
        title: 'Stock Limit',
        text: `Only ${item.stock} items available in stock`,
        confirmButtonColor: '#000'
      })
      return
    }

    if (user) {
      try {
        const token = localStorage.getItem('authToken')
        const res = await fetch(`/api/cart/${item.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ quantity: newQuantity })
        })
        if (!res.ok) return
      } catch (error) {
        console.error('Failed to update quantity:', error)
        return
      }
    } else {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]')
      const guestItem = cart[index]
      if (guestItem) {
        guestItem.quantity = newQuantity
        localStorage.setItem('cart', JSON.stringify(cart))
      }
    }

    const updated = [...cartItems]
    updated[index].quantity = newQuantity
    setCartItems(updated)
    window.dispatchEvent(new Event('cartUpdated'))
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

  const tax = computeTax(taxSettings.taxMode, taxSettings.taxRate, subtotal)
  
  const total = subtotal + calculatedShippingFee + tax

  const totalUnits = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  const shippingLabel = shippingType.toLowerCase() === 'percentage' ? `${shippingFee}%` : 'Fixed'

  return (
    <>
      <div className={styles.overlay} onClick={onClose}></div>
      <div className={styles.cart}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Shopping Bag</h2>
            <p className={styles.itemCount}>{totalUnits} {totalUnits === 1 ? 'item' : 'items'}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
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
                  <img src={getOptimizedImageUrl(item.image) || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt={item.name} />
                </div>
                <div className={styles.itemDetails}>
                  <h3 className={styles.itemName}>{item.name}</h3>
                  <p className={styles.itemVariant}>{item.specs ? Object.values(item.specs).join(' / ') : ''}</p>
                  <p className={styles.itemPriceWrap}>
                    <span className={styles.itemPrice}>LKR {Number(item.price).toLocaleString()}</span>
                    {item.isOnSale === true && Number(item.price) < Number(item.originalPrice) && (
                      <span className={styles.itemOriginalPrice}>LKR {Number(item.originalPrice).toLocaleString()}</span>
                    )}
                  </p>
                  <div className={styles.itemActions}>
                    <div className={styles.quantity}>
                      <button className={styles.qtyBtn} onClick={() => updateQuantity(index, item.quantity - 1)} aria-label="Decrease quantity">
                        <Minus size={14} />
                      </button>
                      <span>{item.quantity}</span>
                      <button className={styles.qtyBtn} onClick={() => updateQuantity(index, item.quantity + 1)} aria-label="Increase quantity">
                        <Plus size={14} />
                      </button>
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
            <span>Shipping ({shippingLabel})</span>
            <span>LKR {calculatedShippingFee.toLocaleString()}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Tax</span>
            <span>LKR {tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className={styles.totalRow}>
            <span>Total</span>
            <span className={styles.totalAmount}>LKR {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
        </div>
      </div>
    </>
  )
}
