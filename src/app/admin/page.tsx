'use client'
import styles from './admin.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, removeAuthToken, getAuthToken } from '@/lib/clientAuth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import { ArrowRight } from 'lucide-react'

function formatLKR(value: number) {
  return `LKR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Admin() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
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
    // Check token expiration
    const currentTime = Math.floor(Date.now() / 1000)
    if (authUser.exp && authUser.exp < currentTime) {
      removeAuthToken()
      router.push('/signin')
      return
    }
    setUser(authUser)

    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load stats')
        return res.json()
      })
      .then(setStats)
      .catch((err) => setError(err.message))
  }, [router])

  if (!user) return null

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Dashboard</h1>
            <p className={styles.pageSubtitle}>Overview of your store performance</p>
          </div>
        </header>

        <div className={styles.content}>
          {error ? (
            <p style={{ color: '#842029' }}>{error}</p>
          ) : !stats ? (
            <p>Loading dashboard...</p>
          ) : (
            <>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span className={styles.statLabel}>Total Revenue</span>
                    <span className={styles.statIcon}>LKR</span>
                  </div>
                  <div className={styles.statValue}>{formatLKR(stats.totalRevenue)}</div>
                  <div className={styles.statChange}>{stats.totalOrders} orders placed</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span className={styles.statLabel}>Orders</span>
                    <span className={styles.statIcon}>◈</span>
                  </div>
                  <div className={styles.statValue}>{stats.totalOrders}</div>
                  <div className={styles.statChange}>{stats.totalUsers} registered users</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span className={styles.statLabel}>Active Products</span>
                    <span className={styles.statIcon}>%</span>
                  </div>
                  <div className={styles.statValue}>{stats.totalProducts}</div>
                  <div className={styles.statChange}>conversion {stats.conversionRate}%</div>
                </div>
              </div>

              <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                  <h3 className={styles.tableTitle}>Top Selling Products</h3>
                  <Link href="/admin/products" className={styles.viewAll}>View All <ArrowRight size={16} /></Link>
                </div>
                {stats.topProducts.length === 0 ? (
                  <p>No product sales yet.</p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Sold</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topProducts.map((product: any) => (
                        <tr key={product.productId}>
                          <td>
                            <div className={styles.productCell}>
                              {product.img && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={product.img} alt={product.name} className={styles.productImage} />
                              )}
                              {product.name}
                            </div>
                          </td>
                          <td className={styles.categoryCell}>{product.category}</td>
                          <td>{formatLKR(product.price)}</td>
                          <td>{product.sold}</td>
                          <td>{formatLKR(product.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
