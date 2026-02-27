'use client'
import styles from './cart.module.css'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { decryptData } from '@/lib/clientEncryption'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'
import Swal from 'sweetalert2'

export default function CartPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [cartItems, setCartItems] = useState<any[]>([])
  const [shippingFee, setShippingFee] = useState(0)
  const [shippingType, setShippingType] = useState('Standard')
  const [loading, setLoading] = useState(true)
  const hasMigrated = useRef(false)
  
  const [deliveryForm, setDeliveryForm] = useState({
    firstName: '',
    lastName: '',
    address: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    phone: ''
  })
  const [saveAddress, setSaveAddress] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('card')

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser) {
      sessionStorage.setItem('redirectAfterLogin', '/customer/cart')
      router.push('/signin')
      return
    }
    setUser(authUser)
    if (!hasMigrated.current) {
      const initCart = async () => {
        await migrateAndLoadCart()
        await loadShippingFee()
        await loadSavedAddress()
      }
      initCart()
    }
  }, [])

  const migrateAndLoadCart = async () => {
    if (hasMigrated.current) return
    hasMigrated.current = true
    
    try {
      const token = localStorage.getItem('authToken')
      const localCart = JSON.parse(localStorage.getItem('cart') || '[]')

      // Load existing cart from DB first
      const res = await fetch('/api/cart', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      const data = decryptData(result.data)
      const existingCart = data.cartItems || []

      // Migrate localStorage cart to DB if exists and DB cart is empty
      if (localCart.length > 0 && existingCart.length === 0) {
        for (const item of localCart) {
          await fetch('/api/cart', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item)
          })
        }
        localStorage.removeItem('cart')
        
        // Reload cart after migration
        const newRes = await fetch('/api/cart', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const newResult = await newRes.json()
        const newData = decryptData(newResult.data)
        await enrichCartItems(newData.cartItems || [])
      } else {
        // Just clear localStorage if DB already has items
        if (localCart.length > 0) {
          localStorage.removeItem('cart')
        }
        await enrichCartItems(existingCart)
      }
    } catch (error) {
      console.error('Failed to load cart:', error)
    } finally {
      setLoading(false)
    }
  }

  const enrichCartItems = async (items: any[]) => {
    const enriched = await Promise.all(items.map(async (item) => {
      try {
        // Fetch product details
        const res = await fetch(`/api/products/${item.productId}`)
        const result = await res.json()
        const product = decryptData(result.data)
        
        // Parse specs if it's a string
        const specs = typeof item.specs === 'string' ? JSON.parse(item.specs) : item.specs
        
        let image = product.prodImg
        let price = product.prodPrice
        let stock = 999
        
        // If SKU exists, fetch SKU details for image and price
        if (item.skuId) {
          try {
            const skuRes = await fetch(`/api/products/${item.productId}/skus`)
            const skuResult = await skuRes.json()
            const skus = decryptData(skuResult.data)
            const sku = skus.find((s: any) => s.id === item.skuId)
            
            if (sku) {
              price = sku.price
              stock = sku.stock
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
        
        return {
          ...item,
          name: product.prodName,
          image: image,
          price: price,
          stock: stock,
          specs: specs
        }
      } catch (error) {
        console.error('Failed to enrich cart item:', error)
        return item
      }
    }))
    setCartItems(enriched)
  }

  const updateQuantity = async (index: number, newQuantity: number) => {
    const item = cartItems[index]
    
    if (newQuantity < 1) return
    
    if (newQuantity > item.stock) {
      Swal.fire({
        icon: 'warning',
        title: 'Stock Limit',
        text: `Only ${item.stock} items available in stock`,
        confirmButtonColor: '#000'
      })
      return
    }
    
    try {
      const token = localStorage.getItem('authToken')
      await fetch(`/api/cart/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ quantity: newQuantity })
      })
      
      const updated = [...cartItems]
      updated[index].quantity = newQuantity
      setCartItems(updated)
    } catch (error) {
      console.error('Failed to update quantity:', error)
    }
  }

  const removeItem = async (index: number) => {
    const item = cartItems[index]
    
    const result = await Swal.fire({
      title: 'Remove Item?',
      text: `Remove "${item.name}" from cart?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#000',
      cancelButtonColor: '#999',
      confirmButtonText: 'Yes, remove it',
      cancelButtonText: 'Cancel'
    })
    
    if (!result.isConfirmed) return
    
    try {
      const token = localStorage.getItem('authToken')
      await fetch(`/api/cart/${item.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      const updated = cartItems.filter((_, i) => i !== index)
      setCartItems(updated)
    } catch (error) {
      console.error('Failed to remove item:', error)
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

  const loadSavedAddress = async () => {
    try {
      const token = localStorage.getItem('authToken')
      console.log('Loading saved address with token:', token ? 'exists' : 'missing')
      const res = await fetch('/api/addresses', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      console.log('Address API response:', result)
      if (result.success && result.data.length > 0) {
        const latestAddress = result.data[0]
        console.log('Latest address:', latestAddress)
        setDeliveryForm({
          firstName: latestAddress.firstName,
          lastName: latestAddress.lastName,
          address: latestAddress.address,
          apartment: latestAddress.apartment || '',
          city: latestAddress.city,
          state: latestAddress.state,
          zipCode: latestAddress.zipCode,
          phone: latestAddress.phone
        })
      } else {
        console.log('No saved addresses found')
      }
    } catch (error) {
      console.error('Failed to load saved address:', error)
    }
  }

  const isDeliveryFormComplete = () => {
    return deliveryForm.firstName && deliveryForm.lastName && deliveryForm.address && 
           deliveryForm.city && deliveryForm.state && deliveryForm.zipCode && deliveryForm.phone
  }

  const handleSaveAddress = async () => {
    if (!isDeliveryFormComplete()) return
    
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(deliveryForm)
      })
      
      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Address Saved!',
          text: 'Your delivery address has been saved for future orders',
          confirmButtonColor: '#000',
          timer: 2000
        })
      }
    } catch (error) {
      console.error('Failed to save address:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to save address',
        confirmButtonColor: '#000'
      })
    }
  }

  const handlePlaceOrder = async () => {
    // Validate cart
    if (cartItems.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Empty Cart',
        text: 'Your cart is empty. Add items before placing an order.',
        confirmButtonColor: '#000'
      })
      return
    }

    // Validate delivery form
    if (!deliveryForm.firstName || !deliveryForm.lastName || !deliveryForm.address || 
        !deliveryForm.city || !deliveryForm.state || !deliveryForm.zipCode || !deliveryForm.phone) {
      Swal.fire({
        icon: 'warning',
        title: 'Incomplete Information',
        text: 'Please fill in all delivery information fields.',
        confirmButtonColor: '#000'
      })
      return
    }

    // Show confirmation
    const result = await Swal.fire({
      title: 'Confirm Order',
      html: `
        <div style="text-align: left; padding: 10px;">
          <p><strong>Total Amount:</strong> LKR ${total.toFixed(2)}</p>
          <p><strong>Payment Method:</strong> ${paymentMethod === 'card' ? 'Card Payment' : 'Cash on Delivery'}</p>
          <p><strong>Delivery Address:</strong><br/>
          ${deliveryForm.firstName} ${deliveryForm.lastName}<br/>
          ${deliveryForm.address}${deliveryForm.apartment ? ', ' + deliveryForm.apartment : ''}<br/>
          ${deliveryForm.city}, ${deliveryForm.state} ${deliveryForm.zipCode}<br/>
          ${deliveryForm.phone}</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#000',
      cancelButtonColor: '#999',
      confirmButtonText: 'Place Order',
      cancelButtonText: 'Cancel'
    })

    if (!result.isConfirmed) return

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: user.email,
          firstName: deliveryForm.firstName,
          lastName: deliveryForm.lastName,
          address: deliveryForm.address,
          apartment: deliveryForm.apartment,
          city: deliveryForm.city,
          state: deliveryForm.state,
          zipCode: deliveryForm.zipCode,
          phone: deliveryForm.phone,
          subtotal: Number(subtotal),
          shippingFee: Number(calculatedShippingFee),
          tax: Number(tax),
          total: Number(total),
          paymentMethod,
          items: cartItems
        })
      })

      const data = await response.json()

      if (data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Order Placed!',
          html: `
            <p>Your order has been placed successfully.</p>
            <p><strong>Order Number:</strong> ${data.data.orderNumber}</p>
            <p>We'll send you a confirmation email shortly.</p>
          `,
          confirmButtonColor: '#000'
        })
        
        // Clear cart and redirect
        setCartItems([])
        router.push('/customer/shop')
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Place order error:', error)
      Swal.fire({
        icon: 'error',
        title: 'Order Failed',
        text: 'Failed to place order. Please try again.',
        confirmButtonColor: '#000'
      })
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const calculatedShippingFee = shippingType.toLowerCase() === 'percentage' 
    ? (subtotal * shippingFee) / 100 
    : shippingFee
  const tax = subtotal * 0.08
  const total = subtotal + calculatedShippingFee + tax

  return (
    <div className={styles.container}>
      <CustomerHeader user={user} onCartOpen={() => {}} />
      
      <div className={styles.content}>
        <div className={styles.leftSection}>
          <h1 className={styles.logo}>369</h1>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Delivery</h2>
            <div className={styles.tabs}>
              <button className={`${styles.tab} ${styles.active}`}>Local</button>
              <button className={styles.tab}>Overseas</button>
            </div>

            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label>Email</label>
                <input type="email" placeholder="your.email@example.com" value={user?.email || ''} readOnly />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>First Name</label>
                  <input 
                    type="text" 
                    placeholder="Jane" 
                    value={deliveryForm.firstName}
                    onChange={(e) => setDeliveryForm({...deliveryForm, firstName: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Last Name</label>
                  <input 
                    type="text" 
                    placeholder="Smith" 
                    value={deliveryForm.lastName}
                    onChange={(e) => setDeliveryForm({...deliveryForm, lastName: e.target.value})}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Address</label>
                <input 
                  type="text" 
                  placeholder="Street address" 
                  value={deliveryForm.address}
                  onChange={(e) => setDeliveryForm({...deliveryForm, address: e.target.value})}
                />
              </div>

              <div className={styles.formGroup}>
                <input 
                  type="text" 
                  placeholder="Apartment, suite, etc. (optional)" 
                  value={deliveryForm.apartment}
                  onChange={(e) => setDeliveryForm({...deliveryForm, apartment: e.target.value})}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>City</label>
                  <input 
                    type="text" 
                    placeholder="New York" 
                    value={deliveryForm.city}
                    onChange={(e) => setDeliveryForm({...deliveryForm, city: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>State</label>
                  <input 
                    type="text" 
                    placeholder="State" 
                    value={deliveryForm.state}
                    onChange={(e) => setDeliveryForm({...deliveryForm, state: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>ZIP Code</label>
                  <input 
                    type="text" 
                    placeholder="10001" 
                    value={deliveryForm.zipCode}
                    onChange={(e) => setDeliveryForm({...deliveryForm, zipCode: e.target.value})}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Phone</label>
                <input 
                  type="tel" 
                  placeholder="+1 (555) 000-0000" 
                  value={deliveryForm.phone}
                  onChange={(e) => setDeliveryForm({...deliveryForm, phone: e.target.value})}
                />
              </div>

              <div className={styles.checkbox}>
                <input 
                  type="checkbox" 
                  id="saveAddress" 
                  checked={saveAddress}
                  onChange={(e) => {
                    setSaveAddress(e.target.checked)
                    if (e.target.checked && isDeliveryFormComplete()) {
                      handleSaveAddress()
                    }
                  }}
                  disabled={!isDeliveryFormComplete()}
                />
                <label htmlFor="saveAddress">Save this address for future orders</label>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Payment</h2>
            
            <div className={styles.paymentMethods}>
              <div 
                className={`${styles.paymentOption} ${paymentMethod === 'card' ? styles.selected : ''}`}
                onClick={() => setPaymentMethod('card')}
              >
                <input 
                  type="radio" 
                  name="payment" 
                  value="card" 
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                />
                <div className={styles.paymentInfo}>
                  <span className={styles.paymentIcon}>💳</span>
                  <div>
                    <div className={styles.paymentTitle}>Card Payment</div>
                    <div className={styles.paymentDesc}>Pay securely with credit or debit card</div>
                  </div>
                </div>
              </div>

              <div 
                className={`${styles.paymentOption} ${paymentMethod === 'cash' ? styles.selected : ''}`}
                onClick={() => setPaymentMethod('cash')}
              >
                <input 
                  type="radio" 
                  name="payment" 
                  value="cash" 
                  checked={paymentMethod === 'cash'}
                  onChange={() => setPaymentMethod('cash')}
                />
                <div className={styles.paymentInfo}>
                  <span className={styles.paymentIcon}>💵</span>
                  <div>
                    <div className={styles.paymentTitle}>Cash on Delivery</div>
                    <div className={styles.paymentDesc}>Pay when you receive your order</div>
                  </div>
                </div>
              </div>
            </div>

            <button className={styles.placeOrderBtn} onClick={handlePlaceOrder}>Place Order</button>
            <p className={styles.terms}>
              By placing your order, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
            </p>
          </section>
        </div>

        <div className={styles.rightSection}>
          <div className={styles.orderSummary}>
            <h2 className={styles.summaryTitle}>Order Summary</h2>
            
            {cartItems.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Your cart is empty</p>
            ) : (
              cartItems.map((item, index) => (
                <div key={index} className={styles.summaryItem}>
                  <img src={item.image || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt={item.name} />
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>{item.name}</div>
                    <div className={styles.itemVariant}>{item.specs ? Object.values(item.specs).join(' / ') : ''}</div>
                    <div className={styles.itemQty}>
                      <button 
                        className={styles.qtyBtn} 
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >−</button>
                      <span>{item.quantity}</span>
                      <button 
                        className={styles.qtyBtn} 
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                        disabled={item.quantity >= item.stock}
                      >+</button>
                      <button 
                        className={styles.removeBtn} 
                        onClick={() => removeItem(index)}
                      >Remove</button>
                    </div>
                  </div>
                  <div className={styles.itemPrice}>LKR {Number(item.price).toLocaleString()}</div>
                </div>
              ))
            )}

            <div className={styles.discountCode}>
              <input type="text" placeholder="Discount code" />
              <button>Apply</button>
            </div>

            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span>LKR {subtotal.toLocaleString()}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Shipping</span>
              <span>{calculatedShippingFee === 0 ? 'Free' : `LKR ${calculatedShippingFee.toLocaleString()}`}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Tax</span>
              <span>LKR {tax.toFixed(2)}</span>
            </div>
            <div className={styles.totalRow}>
              <span>Total</span>
              <span className={styles.totalAmount}>LKR {total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <CustomerFooter />
    </div>
  )
}
