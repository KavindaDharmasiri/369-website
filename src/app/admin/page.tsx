'use client'
import styles from './admin.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, removeAuthToken } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function Admin() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

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
  }, [router])

  const handleLogout = () => {
    removeAuthToken()
    router.push('/signin')
  }

  if (!user) return null

  const topProducts = [
    { name: 'Sculpted Wool Jacket', category: 'Women', price: 895, sold: 342, revenue: 306090, stock: 24 },
    { name: 'Cashmere Crew Neck', category: 'Men', price: 425, sold: 289, revenue: 122825, stock: 18 },
    { name: 'Silk Slip Dress', category: 'Women', price: 695, sold: 267, revenue: 185565, stock: 5 },
    { name: 'Tailored Trousers', category: 'Men', price: 385, sold: 245, revenue: 94325, stock: 32 },
    { name: 'Merino Turtleneck', category: 'Women', price: 295, sold: 223, revenue: 65785, stock: 41 },
  ]

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Dashboard</h1>
            <p className={styles.pageSubtitle}>Overview of your store performance</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.periodBtn}>▦ Last 30 Days</button>
            <button className={styles.exportBtn}>Export Report</button>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>Total Revenue</span>
                <span className={styles.statIcon}>$</span>
              </div>
              <div className={styles.statValue}>$124,563</div>
              <div className={styles.statChange}>+12.5% vs last period</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>Orders</span>
                <span className={styles.statIcon}>◈</span>
              </div>
              <div className={styles.statValue}>1,847</div>
              <div className={styles.statChange}>+8.2% vs last period</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>Conversion Rate</span>
                <span className={styles.statIcon}>%</span>
              </div>
              <div className={styles.statValue}>3.24%</div>
              <div className={`${styles.statChange} ${styles.negative}`}>-2.1% vs last period</div>
            </div>
          </div>

          <div className={styles.chartsGrid}>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Revenue Trend</h3>
              <div className={styles.chartPlaceholder}>Chart placeholder</div>
            </div>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Local vs Overseas</h3>
              <div className={styles.donutPlaceholder}>
                <div className={styles.donutLabel}>Local 68%</div>
                <div className={styles.donutLabel}>Overseas 32%</div>
              </div>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <h3 className={styles.tableTitle}>Top Selling Products</h3>
              <Link href="/admin/products" className={styles.viewAll}>View All →</Link>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Sold</th>
                  <th>Revenue</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, index) => (
                  <tr key={index}>
                    <td>
                      <div className={styles.productCell}>
                        <div className={styles.productImage}></div>
                        {product.name}
                      </div>
                    </td>
                    <td className={styles.categoryCell}>{product.category}</td>
                    <td>${product.price}</td>
                    <td>{product.sold}</td>
                    <td>${product.revenue.toLocaleString()}</td>
                    <td className={product.stock < 10 ? styles.lowStock : ''}>{product.stock} left</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
