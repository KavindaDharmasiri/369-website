'use client'
import styles from './orders.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, removeAuthToken } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function Orders() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('All Orders')

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
  }, [router])

  if (!user) return null

  const orders = [
    { id: '#369-9082', date: 'Oct 24, 2024', items: ['🧥', '👔', '✨'], total: '$4,250.00', status: 'Processing' },
    { id: '#369-8821', date: 'Oct 12, 2024', items: ['👗'], total: '$895.00', status: 'Shipped' },
    { id: '#369-7745', date: 'Sep 28, 2024', items: ['🧥', '👔'], total: '$1,720.00', status: 'Delivered' },
    { id: '#369-6523', date: 'Sep 15, 2024', items: ['🧥'], total: '$4,250.00', status: 'Delivered' },
    { id: '#369-5991', date: 'Aug 30, 2024', items: ['👔'], total: '$3,420.00', status: 'Canceled' },
    { id: '#369-4210', date: 'Aug 12, 2024', items: ['👗', '🧥', '✨'], total: '$1,680.00', status: 'Delivered' },
  ]

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Processing': return styles.statusProcessing
      case 'Shipped': return styles.statusShipped
      case 'Delivered': return styles.statusDelivered
      case 'Canceled': return styles.statusCanceled
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
            <div className={styles.statLabel}>Total Spent</div>
            <div className={styles.statValue}>$4,250.00</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Open Orders</div>
            <div className={styles.statValue}>2</div>
          </div>
        </div>

        <div className={styles.ordersSection}>
          <div className={styles.tabs}>
            {['All Orders', 'Processing', 'Shipped', 'Delivered'].map(tab => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
            <button className={styles.filterBtn}>▼ Filter</button>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className={styles.orderId}>{order.id}</td>
                  <td>{order.date}</td>
                  <td>
                    <div className={styles.items}>
                      {order.items.map((item, i) => (
                        <span key={i} className={styles.itemIcon}>{item}</span>
                      ))}
                    </div>
                  </td>
                  <td className={styles.total}>{order.total}</td>
                  <td>
                    <span className={`${styles.status} ${getStatusClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <button className={styles.viewBtn}>View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>Showing 1-6 of 24 orders</span>
            <div className={styles.paginationBtns}>
              <button className={styles.pageBtn}>‹</button>
              <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>1</button>
              <button className={styles.pageBtn}>2</button>
              <button className={styles.pageBtn}>3</button>
              <span>...</span>
              <button className={styles.pageBtn}>8</button>
              <button className={styles.pageBtn}>›</button>
            </div>
          </div>
        </div>

        <div className={styles.bottomSection}>
          <div className={styles.helpCard}>
            <h3>Need help with an order?</h3>
            <p>Our concierge team is here to assist with returns, exchanges, or sizing questions.</p>
            <button className={styles.contactBtn}>Contact Concierge →</button>
          </div>
          <div className={styles.productCard}>
            <img src="/placeholder.jpg" alt="Product" className={styles.productImg} />
            <div className={styles.productInfo}>
              <div className={styles.productTag}>Complete the Look</div>
              <h4>Cashmere Ribbed Scarf</h4>
              <p>The perfect accompaniment to your Sculpted Wool Jacket. Crafted from 100% Mongolian cashmere.</p>
              <div className={styles.productFooter}>
                <span className={styles.price}>$180.00</span>
                <button className={styles.viewProductBtn}>View Product</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
