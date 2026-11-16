'use client'
import styles from './cart.module.css'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser } from '@/lib/clientAuth'
import { useClientAuthUser } from '@/lib/useClientAuthUser'
import { decryptData } from '@/lib/clientEncryption'
import { enrichServerCartItem } from '@/lib/cartEnrich'
import { computeTax } from '@/lib/pricing'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import { CreditCard, Banknote } from 'lucide-react'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'
import { PageSkeleton } from '@/components/Skeleton'
import Swal from 'sweetalert2'
import Link from 'next/link'
import { ClientRequestError, createRequestGuard, mutationJson, responseJson } from '@/lib/clientRequests'
import { mergeGuestCartDurably, removeSavedGuestItem, withGuestCartLock, GUEST_CART_RECEIPT_KEY, GuestMergeResult } from '@/lib/guestCart'
import { loadCheckoutResources, orderConfirmationText, parseCheckoutQuote, checkoutTotalsDiffer, quoteChangeText } from '@/lib/checkoutState'
import { clearOrderAttempt, PendingCheckoutError, prepareOrderAttempt, readOrderAttempt } from '@/lib/checkoutAttempts'

const QUOTE_ERROR_CODES = new Set(['QUOTE_REQUIRED', 'QUOTE_INVALID', 'QUOTE_EXPIRED', 'QUOTE_MISMATCH', 'QUOTE_CHANGED'])

export default function CartPage() {
  const user = useClientAuthUser()
  const identity = user?.userId ?? (user === undefined ? 'hydrating' : 'signed-out')
  return <CartSession key={identity} user={user} />
}

function CartSession({ user }: { user: any }) {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<any[]>([])
  const [shippingFee, setShippingFee] = useState(0)
  const [shippingType, setShippingType] = useState('Standard')
  const [taxSettings, setTaxSettings] = useState({ taxMode: 'percentage', taxRate: 8 })
  const [loading, setLoading] = useState(true)
  const hasMigrated = useRef(false)
  const initializing = useRef(false)
  const cartMutation = useRef(false)
  const orderSubmission = useRef(false)
  const couponRequests = useRef(createRequestGuard())
  const [changingCart, setChangingCart] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [guestMerge, setGuestMerge] = useState<GuestMergeResult | null>(null)
  const [pendingOrderKey, setPendingOrderKey] = useState<string | null>(null)
  
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
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [placing, setPlacing] = useState(false)
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null)
  const [couponMsg, setCouponMsg] = useState('')
  const [applyingCoupon, setApplyingCoupon] = useState(false)

  const invalidateCoupon = (showMessage = true) => {
    couponRequests.current.invalidate()
    setApplyingCoupon(false)
    setAppliedCoupon(null)
    setCouponMsg(showMessage ? 'The bag changed. Apply your coupon again to refresh its discount.' : '')
  }

  async function initializeCheckout() {
    if (initializing.current || cartMutation.current || orderSubmission.current) return
    initializing.current = true
    setLoading(true)
    setCheckoutError('')
    invalidateCoupon(false)
    try {
      await loadCheckoutResources([migrateAndLoadCart, loadShippingFee, loadTaxSettings, loadSavedAddress, loadPendingOrderAttempt])
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Checkout could not be loaded. Please retry.')
    } finally {
      initializing.current = false
      setLoading(false)
    }
  }

  const loadPendingOrderAttempt = async () => {
    const authUser = getAuthUser()
    const attempt = readOrderAttempt(localStorage, authUser?.userId)
    setPendingOrderKey(attempt?.key || null)
  }

  const resolvePendingOrder = async () => {
    if (orderSubmission.current || cartMutation.current || initializing.current) return
    orderSubmission.current = true
    setPlacing(true)
    try {
      const authUser = getAuthUser()
      const attempt = readOrderAttempt(localStorage, authUser?.userId)
      if (!attempt) { setPendingOrderKey(null); return }
      const answer = await Swal.fire({
        icon: 'question', title: 'Resolve earlier checkout?',
        text: 'This will return an already placed order or retire the earlier request so it cannot create a late order. It never cancels a placed order.',
        showCancelButton: true, confirmButtonText: 'Resolve earlier request', confirmButtonColor: '#000',
      })
      if (!answer.isConfirmed) return
      const token = localStorage.getItem('authToken')
      const result = await responseJson(await fetch(`/api/orders/requests/${encodeURIComponent(attempt.key)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      }))
      const data = result?.data
      if (!result?.success || !['completed', 'abandoned'].includes(data?.state) ||
          (data.state === 'completed' && (!Number.isInteger(data.order?.orderId) || data.order.orderId < 1))) {
        throw new Error('The earlier request could not be resolved. Its key has been kept.')
      }
      clearOrderAttempt(localStorage, authUser.userId, attempt.key)
      setPendingOrderKey(null)
      setCheckoutError('')
      invalidateCoupon(false)
      if (data.state === 'completed') {
        setCartItems([])
        window.dispatchEvent(new Event('cartUpdated'))
        router.push(`/customer/account/orders/${data.order.orderId}`)
      }
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'The earlier request could not be resolved. Its key has been kept.')
    } finally {
      orderSubmission.current = false
      setPlacing(false)
    }
  }

  const migrateAndLoadCart = async () => {
    const token = localStorage.getItem('authToken')
    if (!token) throw new Error('Please sign in again to load your bag.')
    const fetchAccountCart = async () => {
      const result = await responseJson(await fetch('/api/cart', { headers: { Authorization: `Bearer ${token}` } }))
      const data = decryptData(result.data)
      if (!Array.isArray(data?.cartItems)) throw new Error('The account bag response could not be read. Saved items were not discarded.')
      return data.cartItems
    }
    // Confirm access before sending any saved items, even if the account bag is nonempty.
    let accountCart = await fetchAccountCart()
    const result = await withGuestCartLock(() => mergeGuestCartDurably(localStorage, user.userId, async (items, key) => {
      try {
        const body = await responseJson(await fetch('/api/cart/merge', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': key },
          body: JSON.stringify({ items }),
        }))
        return { acknowledged: body.success === true, requestKey: body.data?.requestKey }
      } catch (error) {
        if (error instanceof ClientRequestError) return { acknowledged: false, definitive: error.code === 'CART_NOT_MERGED', message: error.message }
        throw error
      }
    }, () => localStorage.getItem('authToken') === token))
    setGuestMerge(result)
    if (result.migrated > 0 || result.uncertain) accountCart = await fetchAccountCart()
    setCartItems(accountCart.map(enrichServerCartItem))
    window.dispatchEvent(new Event('cartUpdated'))
  }

  const retryGuestMerge = async () => {
    if (initializing.current || cartMutation.current || orderSubmission.current) return
    try {
      if (guestMerge?.uncertain && localStorage.getItem(GUEST_CART_RECEIPT_KEY)) {
        const answer = await Swal.fire({
          icon: 'warning', title: 'Review both bags first',
          text: 'The last import may already be in your account bag. Remove any saved duplicates first. Retrying can add their quantities again. Have you checked both bags?',
          showCancelButton: true, confirmButtonText: 'I checked; retry saved items', confirmButtonColor: '#000',
        })
        if (!answer.isConfirmed) return
        await withGuestCartLock(() => localStorage.removeItem(GUEST_CART_RECEIPT_KEY))
      }
      await initializeCheckout()
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Saved items could not be retried.')
    }
  }

  const discardSavedItem = async (index: number, item: any) => {
    const answer = await Swal.fire({ icon: 'warning', title: 'Remove saved item?', text: 'This removes only the saved copy on this device, not an account-bag item.', showCancelButton: true, confirmButtonColor: '#000' })
    if (!answer.isConfirmed) return
    try {
      const pending = await withGuestCartLock(() => removeSavedGuestItem(localStorage, index, item))
      setGuestMerge((previous) => previous ? { ...previous, pending, uncertain: pending.length > 0 && previous.uncertain } : null)
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'The saved item could not be removed.')
    }
  }

  const runCartMutation = async (operation: () => Promise<void>) => {
    if (cartMutation.current || orderSubmission.current || initializing.current) return
    cartMutation.current = true
    setChangingCart(true)
    invalidateCoupon()
    try {
      await operation()
      window.dispatchEvent(new Event('cartUpdated'))
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'The bag change could not be confirmed. Refresh before checkout.')
    } finally {
      cartMutation.current = false
      setChangingCart(false)
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
    
    await runCartMutation(async () => {
      const token = localStorage.getItem('authToken')
      await mutationJson(await fetch(`/api/cart/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ quantity: newQuantity })
      }))
      setCartItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity: newQuantity } : entry))
    })
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
    
    await runCartMutation(async () => {
      const token = localStorage.getItem('authToken')
      await mutationJson(await fetch(`/api/cart/${item.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }))
      setCartItems((current) => current.filter((entry) => entry.id !== item.id))
    })
  }

  async function loadShippingFee() {
    const result = await responseJson(await fetch('/api/shipping'))
    if (result.data) {
      const shipping = decryptData(result.data)
      if (!shipping || !Number.isFinite(Number(shipping.value)) || Number(shipping.value) < 0 || typeof shipping.type !== 'string') throw new Error('Invalid shipping response')
      setShippingFee(Number(shipping.value))
      setShippingType(shipping.type)
    } else {
      setShippingFee(0)
      setShippingType('Standard')
    }
  }

  async function loadTaxSettings() {
    const result = await responseJson(await fetch('/api/settings'))
    const settings = decryptData(result.data)
    if (!settings || !['percentage', 'fixed'].includes(settings.taxMode) || !Number.isFinite(Number(settings.taxRate)) || Number(settings.taxRate) < 0) throw new Error('Invalid tax settings response')
    setTaxSettings({ taxMode: settings.taxMode, taxRate: Number(settings.taxRate) })
  }

  const loadSavedAddress = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/addresses', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await responseJson(res)
      if (result.success && result.data.length > 0) {
        const latestAddress = result.data[0]
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
      } else {
        await responseJson(response)
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

  const applyCoupon = async () => {
    if (cartMutation.current || orderSubmission.current || initializing.current) return
    const code = couponInput.trim()
    if (!code) {
      Swal.fire({
        icon: 'warning',
        title: 'Enter a Coupon Code',
        text: 'Please enter a coupon code to apply',
        confirmButtonColor: '#000'
      })
      return
    }

    const requestId = couponRequests.current.next()
    setApplyingCoupon(true)
    setCouponMsg('')
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code, subtotal })
      })
      const result = await responseJson(res)
      const data = decryptData(result.data)
      if (!couponRequests.current.isCurrent(requestId)) return
      if (!data || typeof data.valid !== 'boolean') throw new Error('Invalid coupon response')

      if (data.valid) {
        if (typeof data.code !== 'string' || !Number.isFinite(data.discount) || data.discount < 0 || data.discount > subtotal) throw new Error('Invalid coupon amount')
        setAppliedCoupon(data)
        setCouponInput('')
        setCouponMsg('')
      } else {
        setAppliedCoupon(null)
        setCouponMsg(data.message || 'Invalid coupon code')
      }
    } catch (error) {
      if (couponRequests.current.isCurrent(requestId)) {
        setAppliedCoupon(null)
        setCouponMsg(error instanceof Error ? error.message : 'Failed to apply coupon')
      }
    } finally {
      if (couponRequests.current.isCurrent(requestId)) setApplyingCoupon(false)
    }
  }

  const removeCoupon = () => {
    couponRequests.current.invalidate()
    setApplyingCoupon(false)
    setAppliedCoupon(null)
    setCouponMsg('')
  }

  const handlePlaceOrder = async () => {
    if (orderSubmission.current || cartMutation.current || initializing.current || checkoutError || applyingCoupon) return
    orderSubmission.current = true
    setPlacing(true)
    let confirmedOrderId: number | null = null
    let attemptedKey: string | null = null
    let requestSent = false
    try {
      if (cartItems.length === 0) {
        await Swal.fire({
          icon: 'warning', title: 'Empty Cart',
          text: 'Your cart is empty. Add items before placing an order.', confirmButtonColor: '#000'
        })
        return
      }
      if (!isDeliveryFormComplete()) {
        await Swal.fire({
          icon: 'warning', title: 'Incomplete Information',
          text: 'Please fill in all delivery information fields.', confirmButtonColor: '#000'
        })
        return
      }
      const token = localStorage.getItem('authToken')
      const input = {
        email: user.email, ...deliveryForm, paymentMethod, items: cartItems,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      }
      // The dialog total must come from the same server quote the order route
      // verifies, so a stale client total can never be silently charged.
      const quoted = parseCheckoutQuote((await responseJson(await fetch('/api/orders/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(input),
      }))).data)
      const priceChanged = checkoutTotalsDiffer(
        { subtotal, productDiscount: itemSavings, shippingFee: calculatedShippingFee, tax, discount, total },
        quoted.totals)
      const confirmationText = priceChanged
        ? `${quoteChangeText(total, quoted.totals.total)}\n\n${orderConfirmationText({
            total: quoted.totals.total, itemSavings: quoted.totals.productDiscount, discount: quoted.totals.discount,
            couponCode: appliedCoupon?.code, paymentMethod, delivery: deliveryForm })}`
        : orderConfirmationText({
            total: quoted.totals.total, itemSavings: quoted.totals.productDiscount, discount: quoted.totals.discount,
            couponCode: appliedCoupon?.code, paymentMethod, delivery: deliveryForm })
      const result = await Swal.fire({
        title: priceChanged ? 'Review the updated total' : 'Confirm Order',
        text: confirmationText,
        icon: priceChanged ? 'warning' : 'question', showCancelButton: true, confirmButtonColor: '#000', cancelButtonColor: '#999',
        confirmButtonText: priceChanged ? 'Place order at the new total' : 'Place Order', cancelButtonText: 'Cancel'
      })
      if (!result.isConfirmed) return

      const attempt = await prepareOrderAttempt(localStorage, user.userId, input)
      attemptedKey = attempt.key
      setPendingOrderKey(attempt.key)
      requestSent = true
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': attempt.key,
        },
        body: JSON.stringify({ ...input, quoteToken: quoted.quoteToken })
      })

      const data = await responseJson(response)

      if (data?.success && Number.isInteger(data.data?.orderId) && data.data.orderId > 0 && typeof data.data.orderNumber === 'string') {
        confirmedOrderId = data.data.orderId
        clearOrderAttempt(localStorage, user.userId, attempt.key)
        setPendingOrderKey(null)
        setCartItems([])
        removeCoupon()
        window.dispatchEvent(new Event('cartUpdated'))
        await Swal.fire({
          icon: 'success',
          title: 'Order Placed!',
          text: `Your order has been placed successfully. Order Number: ${data.data.orderNumber}`,
          confirmButtonColor: '#000',
          confirmButtonText: 'View My Order'
        })
        
        // Clear cart and redirect to order confirmation
        router.push(`/customer/account/orders/${data.data.orderId}`)
      } else {
        throw new ClientRequestError('The order response could not be confirmed. Check My Orders before retrying.', response.status, true)
      }
    } catch (error) {
      if (confirmedOrderId !== null) {
        router.push(`/customer/account/orders/${confirmedOrderId}`)
        return
      }
      console.error('Place order error:', error)
      const quoteRejected = error instanceof ClientRequestError && QUOTE_ERROR_CODES.has(error.code || '')
      if (quoteRejected) {
        // A quote is verified before any order write, and QUOTE_CHANGED rolls the
        // whole transaction back, so this key provably created no order.
        if (attemptedKey) {
          try {
            clearOrderAttempt(localStorage, user.userId, attemptedKey)
            setPendingOrderKey(null)
          } catch {
            setCheckoutError('The saved request could not be cleared. Resolve it before starting another checkout.')
          }
        }
        setCheckoutError('')
        await Swal.fire({
          icon: 'warning', title: 'Review the updated total',
          text: `${error instanceof Error ? error.message : 'The quote could not be confirmed.'} Nothing has been ordered. Review the current total and try again.`,
          confirmButtonColor: '#000',
        })
        return
      }
      if (error instanceof ClientRequestError && error.code === 'ORDER_REQUEST_ABANDONED' && attemptedKey) {
        try {
          clearOrderAttempt(localStorage, user.userId, attemptedKey)
          setPendingOrderKey(null)
        } catch {
          setCheckoutError('The saved request could not be cleared. Resolve it before starting another checkout.')
        }
      } else if (attemptedKey || error instanceof PendingCheckoutError) {
        setCheckoutError('Resolve the saved checkout or retry its unchanged contents with the same key. Check My Orders before starting another request.')
      }
      Swal.fire({
        icon: 'error',
        title: !requestSent || (error instanceof ClientRequestError && !error.uncertain) ? 'Checkout needs review' : 'Order confirmation unavailable',
        text: !requestSent && error instanceof Error ? error.message : error instanceof ClientRequestError && !error.uncertain ? error.message : 'We could not confirm whether the order was placed. Keep the saved key and resolve the earlier request or retry unchanged.',
        confirmButtonColor: '#000'
      })
    } finally {
      orderSubmission.current = false
      setPlacing(false)
    }
  }

  useEffect(() => {
    if (user === undefined) return
    if (!user) {
      sessionStorage.setItem('redirectAfterLogin', '/customer/cart')
      router.push('/signin')
      return
    }
    if (!hasMigrated.current) {
      hasMigrated.current = true
      initializing.current = true
      // Initial state is already loading with no coupon/error to clear.
      // Retry events use initializeCheckout, which explicitly resets that UI.
      void loadCheckoutResources([migrateAndLoadCart, loadShippingFee, loadTaxSettings, loadSavedAddress, loadPendingOrderAttempt])
        .catch(error => setCheckoutError(error instanceof Error ? error.message : 'Checkout could not be loaded. Please retry.'))
        .finally(() => {
          initializing.current = false
          setLoading(false)
        })
    }
    const requests = couponRequests.current
    return () => requests.invalidate()
  }, [user, router])

  if (loading) {
    return (
      <div>
        <CustomerHeader user={user} onCartOpen={() => {}} />
        <div style={{ padding: '40px' }}>
          <PageSkeleton />
        </div>
        <CustomerFooter />
      </div>
    )
  }

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const itemSavings = cartItems.reduce((sum, item) => sum + (item.isOnSale ? ((Number(item.originalPrice) - Number(item.price)) * item.quantity) : 0), 0)
  const calculatedShippingFee = shippingType.toLowerCase() === 'percentage' 
    ? (subtotal * shippingFee) / 100 
    : shippingFee
  const tax = computeTax(taxSettings.taxMode, taxSettings.taxRate, subtotal)
  const discount = appliedCoupon?.discount || 0
  const total = subtotal - discount + calculatedShippingFee + tax

  return (
    <div className={styles.container}>
      <CustomerHeader user={user} onCartOpen={() => {}} />

      {pendingOrderKey && (
        <div role="status" style={{ padding: '20px', border: '1px solid #bbb', margin: '20px' }}>
          <p>A checkout identity is saved on this device. Unchanged retries reuse it. Resolve it before changing the checkout.</p>
          <button onClick={resolvePendingOrder} disabled={placing || changingCart}>Resolve earlier checkout</button>
        </div>
      )}

      {checkoutError && (
        <div role="alert" style={{ padding: '20px', border: '1px solid #c8102e', margin: '20px' }}>
          <p>{checkoutError}</p>
          <Link href="/customer/account/orders">Check My Orders</Link>{' '}
          <button onClick={initializeCheckout} disabled={changingCart || placing}>Reload checkout</button>
        </div>
      )}
      {guestMerge && guestMerge.pending.length > 0 && (
        <section aria-label="Saved items awaiting import" style={{ padding: '20px', border: '1px solid #bbb', margin: '20px' }}>
          <p role="status">{guestMerge.message || 'Some saved items remain on this device.'}</p>
          <p>Only the account-bag items shown in the order summary will be ordered.</p>
          <ul>
            {guestMerge.pending.map((item, index) => (
              <li key={index}>
                {Number.isInteger(item?.productId) && item.productId > 0
                  ? <Link href={`/customer/product?id=${item.slug || item.productId}`}>{typeof item.name === 'string' ? item.name : 'Review product options'}</Link>
                  : 'Unreadable saved item'}
                {' '}<button onClick={() => discardSavedItem(index, item)} disabled={changingCart || placing}>Remove saved copy</button>
              </li>
            ))}
          </ul>
          <button onClick={retryGuestMerge} disabled={changingCart || placing}>Review and retry saved items</button>
        </section>
      )}
      
      <div className={styles.content}>
        <div className={styles.leftSection}>
          <h1 className={styles.logo}>369</h1>

          <section className={styles.section} id="checkout-delivery">
            <h2 className={styles.sectionTitle}>Delivery</h2>

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

          <section className={styles.section} id="checkout-payment" data-assist-payment={paymentMethod}>
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
                  <span className={styles.paymentIcon}><CreditCard size={28} /></span>
                  <div>
                    <div className={styles.paymentTitle}>Card Payment</div>
                    <div className={styles.paymentDesc}>Pay with card when your order is delivered</div>
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
                  <span className={styles.paymentIcon}><Banknote size={28} /></span>
                  <div>
                    <div className={styles.paymentTitle}>Cash on Delivery</div>
                    <div className={styles.paymentDesc}>Pay when you receive your order</div>
                  </div>
                </div>
              </div>
            </div>

            <button id="checkout-place-order" className={styles.placeOrderBtn} onClick={handlePlaceOrder} disabled={placing || changingCart || applyingCoupon || !!checkoutError || cartItems.length === 0}>
              {placing ? 'Placing Order...' : 'Place Order'}
            </button>
            <p className={styles.terms}>
              By placing your order, you agree to our Terms of Service and Privacy Policy
            </p>
          </section>
        </div>

        <div className={styles.rightSection}>
          <div className={styles.orderSummary} id="checkout" data-assist-count={cartItems.length}>
            <h2 className={styles.summaryTitle}>Order Summary</h2>
            
            {cartItems.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Your cart is empty</p>
            ) : (
              cartItems.map((item, index) => (
                <div key={index} className={styles.summaryItem}>
                  <img src={getOptimizedImageUrl(item.image) || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt={item.name} />
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>{item.name}</div>
                    <div className={styles.itemVariant}>{item.specs ? Object.values(item.specs).join(' / ') : ''}</div>
                    <div className={styles.itemQty}>
                      <button 
                        className={styles.qtyBtn} 
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                        disabled={item.quantity <= 1 || changingCart || placing || !!checkoutError}
                      >−</button>
                      <span>{item.quantity}</span>
                      <button 
                        className={styles.qtyBtn} 
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                        disabled={changingCart || placing || !!checkoutError || (item.stock != null && item.quantity >= item.stock)}
                      >+</button>
                      <button 
                        className={styles.removeBtn} 
                        onClick={() => removeItem(index)}
                        disabled={changingCart || placing || !!checkoutError}
                      >Remove</button>
                    </div>
                  </div>
                  <div className={styles.itemPriceWrap}>
                    <div className={`${styles.itemPrice} ${item.isOnSale ? styles.itemSalePrice : ''}`}>LKR {Number(item.price).toLocaleString()}</div>
                    {item.isOnSale && <div className={styles.itemOriginalPrice}>LKR {Number(item.originalPrice).toLocaleString()}</div>}
                  </div>
                </div>
              ))
            )}

            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span>LKR {subtotal.toLocaleString()}</span>
            </div>

            {appliedCoupon ? (
              <div className={styles.discountApplied}>
                <div>
                  <span className={styles.discountLabel}>Discount ({appliedCoupon.code})</span>
                  <button className={styles.discountRemove} onClick={removeCoupon} disabled={placing || changingCart}>Remove</button>
                </div>
                <span>-LKR {appliedCoupon.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            ) : (
              <div className={styles.discountCode}>
                <input
                  type="text"
                  id="checkout-coupon"
                  data-assist-coupon={appliedCoupon ? 'applied' : 'none'}
                  placeholder="Enter coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                  disabled={applyingCoupon || changingCart || placing || !!checkoutError}
                />
                <button onClick={applyCoupon} disabled={applyingCoupon || changingCart || placing || !!checkoutError}>
                  {applyingCoupon ? '...' : 'Apply'}
                </button>
              </div>
            )}
            {couponMsg && <p className={styles.couponError}>{couponMsg}</p>}

            {itemSavings > 0 && (
              <div className={styles.itemDiscountRow}>
                <span>Item Discounts</span>
                <span>-LKR {itemSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}

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
