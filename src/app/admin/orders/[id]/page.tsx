'use client'
import styles from './detail.module.css'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getAuthUser, removeAuthToken } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function OrderDetail() {
  const router = useRouter()
  const params = useParams()
  const [user, setUser] = useState<any>(null)
  const [order, setOrder] = useState<any>(null)

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser || authUser.userType !== 'admin') {
      router.push('/signin')
      return
    }
    setUser(authUser)
    fetchOrder()
  }, [])

  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch(`/api/orders/${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      if (result.success) {
        setOrder(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch order:', error)
    }
  }

  if (!user || !order) return null

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
                }
              } catch (error) {
                console.error('Failed to update status:', error)
              }
            }}
          >
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="canceled">Canceled</option>
          </select>
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
                <span className={styles[`status${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`]}>{order.status}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Payment:</span>
                <span>{order.paymentMethod}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Subtotal:</span>
                <span>LKR {Number(order.subtotal).toFixed(2)}</span>
              </div>
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
              const specs = item.specs ? JSON.parse(item.specs) : null
              return (
                <div key={item.id} className={styles.itemCard}>
                  <div className={styles.itemImage}>
                    <img src={item.image || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt={item.productName} />
                  </div>
                  <div className={styles.itemDetails}>
                    <h3 className={styles.itemName}>{item.productName}</h3>
                    {specs && (
                      <p className={styles.itemSpecs}>{Object.values(specs).join(' / ')}</p>
                    )}
                    <div className={styles.itemMeta}>
                      <span>Qty: {item.quantity}</span>
                      <span>LKR {Number(item.price).toFixed(2)}</span>
                    </div>
                    <div className={styles.itemTotal}>Total: LKR {Number(item.subtotal).toFixed(2)}</div>
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
