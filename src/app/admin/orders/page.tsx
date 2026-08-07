'use client'
import styles from './orders.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, removeAuthToken } from '@/lib/clientAuth'
import { decryptData } from '@/lib/clientEncryption'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function Orders() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('All Orders')
  const [orders, setOrders] = useState<any[]>([])
  const [stats, setStats] = useState({ totalSpent: 0, openOrders: 0 })

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser) {
      router.push('/signin')
      return
    }
    if (authUser.userType !== 'admin') {
      router.push('/customer/shop')
      return
    }
    const currentTime = Math.floor(Date.now() / 1000)
    if (authUser.exp && authUser.exp < currentTime) {
      removeAuthToken()
      router.push('/signin')
      return
    }
    setUser(authUser)
    fetchOrders()
  }, [router])

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      
      if (!result.success) {
        console.error('Failed to fetch orders:', result.error)
        return
      }
      
      const data = result.data.orders ? result.data : { orders: result.data }
      setOrders(data.orders || [])
      
      const totalSpent = (data.orders || []).reduce((sum: number, order: any) => sum + Number(order.total), 0)
      const openOrders = (data.orders || []).filter((o: any) => ['pending', 'shipped'].includes(o.status.toLowerCase())).length
      setStats({ totalSpent, openOrders })
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    }
  }

  if (!user) return null

  const filteredOrders = activeTab === 'All Orders' 
    ? orders 
    : activeTab === 'Pending'
    ? orders.filter(o => o.status.toLowerCase() === 'pending')
    : activeTab === 'Processing'
    ? orders.filter(o => o.status.toLowerCase() === 'processing')
    : orders.filter(o => o.status.toLowerCase() === activeTab.toLowerCase())

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return styles.statusPending
      case 'processing': return styles.statusProcessing
      case 'paid': return styles.statusPaid
      case 'shipped': return styles.statusShipped
      case 'delivered': return styles.statusDelivered
      case 'cancelled':
      case 'canceled': return styles.statusCanceled
      case 'refunded': return styles.statusRefunded
      default: return ''
    }
  }

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.breadcrumb}>
          <Link href="/admin">Dashboard</Link>
          <span> / </span>
          <span>Orders</span>
        </div>

        <div className={styles.topSection}>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Total Earned</div>
            <div className={styles.statValue}>LKR {stats.totalSpent.toFixed(2)}</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Open Orders</div>
            <div className={styles.statValue}>{stats.openOrders}</div>
          </div>
        </div>

        <div className={styles.ordersSection}>
          <div className={styles.tabs}>
            {['All Orders', 'Pending', 'Processing', 'Shipped', 'Delivered'].map(tab => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td className={styles.orderId}>#{order.orderNumber}</td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>{order.firstName} {order.lastName}</td>
                    <td>{order.orderItems?.length || 0} items</td>
                    <td className={styles.total}>LKR {Number(order.total).toFixed(2)}</td>
                    <td>
                      <span className={`${styles.status} ${getStatusClass(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      <button className={styles.viewBtn} onClick={() => router.push(`/admin/orders/${order.id}`)}>View Details</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>Showing {filteredOrders.length} orders</span>
          </div>
        </div>
      </main>
    </div>
  )
}
