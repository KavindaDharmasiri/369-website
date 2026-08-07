'use client'
import styles from '../adminShared.module.css'
import reportStyles from './reports.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, removeAuthToken, getAuthToken } from '@/lib/clientAuth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import { Skeleton } from '@/components/Skeleton'

const ORDER_STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  PAID: '#3b82f6',
  SHIPPED: '#8b5cf6',
  DELIVERED: '#10b981',
  CANCELLED: '#ef4444',
  REFUNDED: '#6b7280',
}

export default function AdminReports() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
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

    const token = getAuthToken()
    Promise.all([
      fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([statsJson, ordersJson]) => {
        setStats(statsJson)
        setOrders(ordersJson.data?.orders || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [router])

  if (!user) return null

  const statusCounts = ORDER_STATUSES.map((status) => ({
    status,
    count: orders.filter((o) => o.status === status).length,
  }))
  const totalOrders = orders.length || 1

  const orderRevenue = orders
    .filter((o) => o.status !== 'CANCELLED' && o.status !== 'REFUNDED')
    .reduce((sum, o) => sum + Number(o.total || 0), 0)

  const maxSold = stats?.topProducts?.length ? Math.max(...stats.topProducts.map((p: any) => p.sold)) : 0

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Reports & Analytics</h1>
            <div className={styles.breadcrumb}>
              <Link href="/admin">Dashboard</Link>
              <span> / </span>
              <span className={styles.breadcrumbActive}>Reports</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height="120px" />
            <Skeleton height="300px" />
          </div>
        ) : error ? (
          <p className={styles.errorText}>{error}</p>
        ) : (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Revenue</div>
                <div className={styles.statValue}>
                  LKR {Number(stats?.totalRevenue || orderRevenue).toLocaleString()}
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Orders</div>
                <div className={styles.statValue}>{stats?.totalOrders ?? totalOrders}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Users</div>
                <div className={styles.statValue}>{stats?.totalUsers ?? 0}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Conversion Rate</div>
                <div className={styles.statValue}>{stats?.conversionRate ?? 0}%</div>
              </div>
            </div>

            <div className={reportStyles.chartsGrid}>
              <div className={styles.tableSection}>
                <div className={styles.tableHeader}>
                  <h3>Sales by Product</h3>
                </div>
                <div className={reportStyles.barList}>
                  {stats?.topProducts?.length ? (
                    stats.topProducts.map((p: any) => (
                      <div key={p.productId} className={reportStyles.barItem}>
                        <div className={reportStyles.barLabel}>
                          <span>
                            <strong>{p.name}</strong>
                            <span style={{ color: '#6c757d', fontSize: 12 }}> · {p.category}</span>
                          </span>
                          <span style={{ fontSize: 13 }}>
                            {p.sold} sold · <strong>LKR {Number(p.revenue).toLocaleString()}</strong>
                          </span>
                        </div>
                        <div className={reportStyles.barTrack}>
                          <div
                            className={reportStyles.barFill}
                            style={{ width: maxSold ? `${Math.max((p.sold / maxSold) * 100, 4)}%` : '4%' }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyState}>No sales data yet.</div>
                  )}
                </div>
              </div>

              <div className={styles.tableSection}>
                <div className={styles.tableHeader}>
                  <h3>Orders by Status</h3>
                </div>
                <div className={reportStyles.donutWrap}>
                  <div className={reportStyles.donut}>
                    {(() => {
                      let acc = 0
                      return statusCounts.map(({ status, count }) => {
                        const start = (acc / totalOrders) * 360
                        acc += count
                        const end = (acc / totalOrders) * 360
                        return (
                          <div
                            key={status}
                            className={reportStyles.donutSlice}
                            style={{
                              background: `conic-gradient(from ${start}deg, transparent 0deg, transparent ${start}deg, ${STATUS_COLORS[status]} ${start}deg, ${STATUS_COLORS[status]} ${end}deg, transparent ${end}deg, transparent 360deg)`,
                            }}
                          />
                        )
                      })
                    })()}
                    <div className={reportStyles.donutCenter}>
                      <strong>{orders.length}</strong>
                      <span>orders</span>
                    </div>
                  </div>
                  <div className={reportStyles.legend}>
                    {statusCounts.map(({ status, count }) => (
                      <div key={status} className={reportStyles.legendItem}>
                        <span className={reportStyles.legendDot} style={{ background: STATUS_COLORS[status] }} />
                        <span className={reportStyles.legendLabel}>{status}</span>
                        <span className={reportStyles.legendValue}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {stats?.topProducts?.length ? (
              <div className={styles.tableSection} style={{ marginTop: 24 }}>
                <div className={styles.tableHeader}>
                  <h3>Top Products</h3>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Units Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topProducts.map((p: any) => (
                      <tr key={p.productId}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {p.img && (
                              <img src={p.img} alt={p.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                            )}
                            <strong>{p.name}</strong>
                          </div>
                        </td>
                        <td>{p.category}</td>
                        <td>LKR {Number(p.price).toLocaleString()}</td>
                        <td>{p.sold}</td>
                        <td>LKR {Number(p.revenue).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  )
}
