'use client'
import styles from './transactions.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, removeAuthToken, getAuthToken } from '@/lib/clientAuth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#fff3cd', color: '#664d03' },
  PAID: { bg: '#d1e7dd', color: '#0f5132' },
  SHIPPED: { bg: '#cfe2ff', color: '#084298' },
  DELIVERED: { bg: '#d1e7dd', color: '#0f5132' },
  CANCELLED: { bg: '#f8d7da', color: '#842029' },
  REFUNDED: { bg: '#e2e3e5', color: '#41464b' },
}

function formatLKR(value: number) {
  return `LKR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Transactions() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

    fetch('/api/orders', { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to fetch orders')
        setOrders(json.data?.orders || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [router])

  if (!user) return null

  const totalVolume = orders.reduce((sum, o) => sum + Number(o.total || 0), 0)
  const completed = orders.filter((o) => o.status === 'DELIVERED' || o.status === 'PAID' || o.status === 'SHIPPED').length
  const successRate = orders.length ? Math.round((completed / orders.length) * 100) : 0
  const avgOrder = orders.length ? totalVolume / orders.length : 0

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Order Transactions</h1>
          <div className={styles.breadcrumb}>
            <Link href="/admin">Transactions</Link>
            <span> / </span>
            <span className={styles.breadcrumbActive}>All Transactions</span>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Transactions</div>
            <div className={styles.statValue}>{orders.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Volume</div>
            <div className={styles.statValue}>{formatLKR(totalVolume)}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Average Order Value</div>
            <div className={styles.statValue}>{formatLKR(avgOrder)}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Completed Rate</div>
            <div className={styles.statValue}>{successRate}%</div>
          </div>
        </div>

        <div className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <h3>All Transactions</h3>
          </div>

          {loading ? (
            <p>Loading transactions...</p>
          ) : error ? (
            <p style={{ color: '#842029' }}>{error}</p>
          ) : orders.length === 0 ? (
            <p>No orders yet.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Time</th>
                  <th>Items</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const badge = STATUS_COLORS[o.status] || STATUS_COLORS.PENDING
                  return (
                    <tr key={o.id}>
                      <td className={styles.walletId}>{o.orderNumber}</td>
                      <td>{o.firstName} {o.lastName} ({o.email})</td>
                      <td>{new Date(o.createdAt).toLocaleString()}</td>
                      <td>{o.orderItems?.length || 0}</td>
                      <td>{formatLKR(o.total)}</td>
                      <td>
                        <span
                          className={styles.statusBadge}
                          style={{ background: badge.bg, color: badge.color }}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td>
                        <Link href={`/admin/orders/${o.id}`} style={{ color: '#0d6efd', fontSize: 14 }}>
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
