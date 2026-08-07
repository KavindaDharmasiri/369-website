'use client'
import styles from './detail.module.css'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getAuthUser, removeAuthToken } from '@/lib/clientAuth'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import { Skeleton } from '@/components/Skeleton'

const ORDER_STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']

const getStatusClass = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending': return 'statusPending'
    case 'processing': return 'statusProcessing'
    case 'paid': return 'statusPaid'
    case 'shipped': return 'statusShipped'
    case 'delivered': return 'statusDelivered'
    case 'cancelled':
    case 'canceled': return 'statusCanceled'
    case 'refunded': return 'statusRefunded'
    default: return ''
  }
}

export default function OrderDetail() {
  const router = useRouter()
  const params = useParams()
  const [user, setUser] = useState<any>(null)
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser || authUser.userType !== 'admin') {
      router.push('/signin')
      return
    }
    const currentTime = Math.floor(Date.now() / 1000)
    if (authUser.exp && authUser.exp < currentTime) {
      removeAuthToken()
      router.push('/signin')
      return
    }
    setUser(authUser)
    fetchOrder()
  }, [])

  const fetchOrder = async () => {
    setError(null)
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch(`/api/orders/${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      if (result.success) {
        setOrder(result.data)
      } else {
        setError(result.error || 'Failed to fetch order')
      }
    } catch (error) {
      console.error('Failed to fetch order:', error)
      setError('Failed to fetch order')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  if (loading) {
    return (
      <div className={styles.container}>
        <AdminSidebar userEmail={user.email} />
        <main className={styles.main}>
          <Skeleton width="40%" height="28px" />
          <div style={{ height: 20 }} />
          <Skeleton height="140px" />
          <div style={{ height: 20 }} />
          <Skeleton height="200px" />
        </main>
      </div>
    )
  }

  if (!order) {
    return (
      <div className={styles.container}>
        <AdminSidebar userEmail={user.email} />
        <main className={styles.main}>
          <p style={{ color: '#842029', padding: '20px 0' }}>{error || 'Order not found'}</p>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.breadcrumb}>
          <Link href="/admin">Dashboard</Link>
          <span> / </span>
          <Link href="/admin/orders">Orders</Link>
          <span> / </span>
          <span>#{order.orderNumber}</span>
        </div>

        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Order #{order.orderNumber}</h1>
            <p className={styles.date}>{new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <select 
            className={styles.statusSelect} 
            value={order.status} 
            onChange={async (e) => {
              const newStatus = e.target.value
              try {
                const token = localStorage.getItem('authToken')
                const res = await fetch(`/api/orders/${order.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ status: newStatus })
                })
                if (res.ok) {
                  setOrder({ ...order, status: newStatus })
                } else {
                  const err = await res.json().catch(() => null)
                  console.error('Failed to update status:', err?.error || res.status)
                }
              } catch (error) {
                console.error('Failed to update status:', error)
              }
            }}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.pdfBtn}
            onClick={() => window.open(`/api/orders/${order.id}/pdf`, '_blank')}
          >
            Download Invoice PDF
          </button>
        </div>

        <div className={styles.grid}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Customer Information</h2>
            <div className={styles.info}>
              <div className={styles.infoRow}>
                <span className={styles.label}>Name:</span>
                <span>{order.firstName} {order.lastName}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Email:</span>
                <span>{order.email}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Phone:</span>
                <span>{order.phone}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Address:</span>
                <span>{order.address}{order.apartment ? `, ${order.apartment}` : ''}<br/>{order.city}, {order.state} {order.zipCode}</span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Order Details</h2>
            <div className={styles.info}>
              <div className={styles.infoRow}>
                <span className={styles.label}>Status:</span>
                <span className={styles[getStatusClass(order.status)]}>{order.status}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Payment:</span>
                <span>{order.paymentMethod}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Subtotal:</span>
                <span>LKR {Number(order.subtotal).toFixed(2)}</span>
              </div>
              {Number(order.productDiscount) > 0 && (
                <div className={styles.infoRow}>
                  <span className={styles.label}>Item Discounts:</span>
                  <span>-LKR {Number(order.productDiscount).toFixed(2)}</span>
                </div>
              )}
              {Number(order.discount) > 0 && (
                <div className={styles.infoRow}>
                  <span className={styles.label}>Coupon Discount{order.couponCode ? ` (${order.couponCode})` : ''}:</span>
                  <span>-LKR {Number(order.discount).toFixed(2)}</span>
                </div>
              )}
              <div className={styles.infoRow}>
                <span className={styles.label}>Shipping:</span>
                <span>LKR {Number(order.shippingFee).toFixed(2)}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Tax:</span>
                <span>LKR {Number(order.tax).toFixed(2)}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Total:</span>
                <strong>LKR {Number(order.total).toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Order Items</h2>
          <div className={styles.itemsGrid}>
            {order.orderItems?.map((item: any) => {
              let specs = null
              if (item.specs) {
                try { specs = JSON.parse(item.specs) } catch { specs = null }
              }
              return (
                <div key={item.id} className={styles.itemCard}>
                  <div className={styles.itemImage}>
                    <img src={getOptimizedImageUrl(item.image) || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt={item.productName} />
                  </div>
                  <div className={styles.itemDetails}>
                    <h3 className={styles.itemName}>{item.productName}</h3>
                    {item.skuCode && (
                      <p className={styles.itemSpecs} style={{ color: '#6c757d', fontSize: 12 }}>
                        SKU: {item.skuCode}
                      </p>
                    )}
                    {specs && (
                      <p className={styles.itemSpecs}>{Object.values(specs).join(' / ')}</p>
                    )}
                    <div className={styles.itemMeta}>
                      <span>Qty: {item.quantity}</span>
                      <span>
                        Unit:{' '}
                        {Number(item.originalPrice) > Number(item.price) && (
                          <span style={{ textDecoration: 'line-through', color: '#999', marginRight: '6px' }}>LKR {Number(item.originalPrice).toFixed(2)}</span>
                        )}
                        LKR {Number(item.price).toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.itemTotal}>Subtotal: LKR {Number(item.subtotal).toFixed(2)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
