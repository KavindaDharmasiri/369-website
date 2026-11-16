'use client'
import { useState, useEffect } from 'react'
import styles from '../account.module.css'
import { TableSkeleton } from '@/components/Skeleton'

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const token = localStorage.getItem('authToken')
    fetch('/api/orders', {
      signal: controller.signal, headers: { 'Authorization': `Bearer ${token}` },
    }).then(res => {
      if (!res.ok) throw new Error('Orders could not be loaded')
      return res.json()
    }).then(result => {
      if (controller.signal.aborted) return
      if (result.success) {
        const data = result.data.orders ? result.data.orders : result.data
        setOrders(Array.isArray(data) ? data : [])
      }
    }).catch(error => {
      if (controller.signal.aborted) return
      console.error('Failed to fetch orders:', error)
      setError('Orders could not be loaded. Please reload to try again.')
      setOrders([])
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [])

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered': return 'delivered'
      case 'shipped': return 'shipped'
      case 'pending': return 'pending'
      case 'paid': return 'paid'
      case 'cancelled':
      case 'canceled': return 'cancelled'
      case 'refunded': return 'refunded'
      case 'processing':
      default: return 'processing'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true
    if (activeTab === 'progress') return ['pending', 'processing', 'shipped'].includes(order.status.toLowerCase())
    if (activeTab === 'delivered') return order.status.toLowerCase() === 'delivered'
    if (activeTab === 'returns') return order.status.toLowerCase() === 'returned'
    return true
  })

  if (error) return <p role="alert">{error}</p>

  return (
    <div className={styles.orderHistory}>
      <h1>Order History</h1>
      <p>Review your past purchases and track current orders</p>
      
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Orders
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'progress' ? styles.active : ''}`}
          onClick={() => setActiveTab('progress')}
        >
          In Progress
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'delivered' ? styles.active : ''}`}
          onClick={() => setActiveTab('delivered')}
        >
          Delivered
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'returns' ? styles.active : ''}`}
          onClick={() => setActiveTab('returns')}
        >
          Returns
        </button>
      </div>

      <table className={styles.orderTable}>
        <thead>
          <tr>
            <th>Order Number</th>
            <th>Date</th>
            <th>Items</th>
            <th>Total</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} style={{ padding: '24px 16px' }}>
                <TableSkeleton rows={4} cols={6} />
              </td>
            </tr>
          ) : filteredOrders.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                No orders found
              </td>
            </tr>
          ) : (
            filteredOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.orderNumber}</td>
                <td>{formatDate(order.createdAt)}</td>
                <td>
                  <div>
                    {order.orderItems.slice(0, 2).map((item: any, index: number) => (
                      <div key={index}>{item.productName}</div>
                    ))}
                    {order.orderItems.length > 2 && (
                      <div>{order.orderItems.length - 2} more items</div>
                    )}
                  </div>
                </td>
                <td>LKR {order.total}</td>
                <td>
                  <span className={`${styles.status} ${styles[getStatusClass(order.status)]}`}>
                    {order.status}
                  </span>
                </td>
                <td>
                  <a href={`/customer/account/orders/${order.id}`} className={styles.viewDetails}>
                    View Details
                  </a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
