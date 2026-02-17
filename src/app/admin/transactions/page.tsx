'use client'
import styles from './transactions.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, removeAuthToken } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function Transactions() {
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
    const currentTime = Math.floor(Date.now() / 1000)
    if (authUser.exp && authUser.exp < currentTime) {
      removeAuthToken()
      router.push('/signin')
      return
    }
    setUser(authUser)
  }, [router])

  if (!user) return null

  const transactions = [
    { id: 487, type: 'CREDIT', wallet: 'ff6fc7d2-45e1-4dd7-8942-2ac5d0a64f6b', time: '2025-12-31T04:48:42.000+00:00', pointType: 'New', pointValue: 1, points: 0, amount: 'LKR0.00', status: 'NEW' },
    { id: 484, type: 'CREDIT', wallet: 'a0894330-72c9-4f56-85df-26069d9f437a', time: '2025-12-31T04:48:42.000+00:00', pointType: 'udt', pointValue: 1, points: 5000, amount: 'LKR5,000.00', status: 'NEW' },
    { id: 479, type: 'CREDIT', wallet: 'ff6fc7d2-45e1-4dd7-8942-2ac5d0a64f6b', time: '2025-12-31T04:41:13.000+00:00', pointType: 'New', pointValue: 1, points: 0, amount: 'LKR0.00', status: 'NEW' },
    { id: 476, type: 'CREDIT', wallet: 'a0894330-72c9-4f56-85df-26069d9f437a', time: '2025-12-31T04:41:12.000+00:00', pointType: 'udt', pointValue: 1, points: 7000, amount: 'LKR7,000.00', status: 'NEW' },
    { id: 471, type: 'CREDIT', wallet: 'ff6fc7d2-45e1-4dd7-8942-2ac5d0a64f6b', time: '2025-12-31T04:34:21.000+00:00', pointType: 'New', pointValue: 1, points: 0, amount: 'LKR0.00', status: 'NEW' },
    { id: 468, type: 'CREDIT', wallet: 'a0894330-72c9-4f56-85df-26069d9f437a', time: '2025-12-31T04:34:21.000+00:00', pointType: 'udt', pointValue: 1, points: 4000, amount: 'LKR4,000.00', status: 'NEW' },
  ]

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>All Transactions</h1>
          <div className={styles.breadcrumb}>
            <Link href="/admin">Transactions</Link>
            <span> / </span>
            <span className={styles.breadcrumbActive}>All Transaction</span>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Transactions</div>
            <div className={styles.statValue}>Rs. 12.2 Million</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Volume</div>
            <div className={styles.statValue}>18,911</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Average Points</div>
            <div className={styles.statValue}>2,850</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Success Rate</div>
            <div className={styles.statValue}>78%</div>
          </div>
        </div>

        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <h3>Transaction volume trend</h3>
            <select className={styles.periodSelect}>
              <option>Annually</option>
            </select>
          </div>
          <div className={styles.chartPlaceholder}></div>
        </div>

        <div className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <h3>All Transactions</h3>
            <button className={styles.filterBtn}>⚙ Apply Filters</button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tx ID</th>
                <th>Tx Type</th>
                <th>Wallet ID</th>
                <th>Time</th>
                <th>Point Type</th>
                <th>Point Value</th>
                <th>Points</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.id}</td>
                  <td>{tx.type}</td>
                  <td className={styles.walletId}>{tx.wallet}</td>
                  <td>{tx.time}</td>
                  <td>{tx.pointType}</td>
                  <td>{tx.pointValue}</td>
                  <td>{tx.points}</td>
                  <td>{tx.amount}</td>
                  <td><span className={styles.statusBadge}>{tx.status}</span></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.pagination}>
            <div className={styles.paginationLeft}>
              <span>Show</span>
              <select className={styles.pageSize}>
                <option>6</option>
              </select>
              <span>per page</span>
            </div>
            <div className={styles.paginationRight}>
              <span>1 / 9 Pages</span>
              <button className={styles.pageBtn}>«</button>
              <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>1</button>
              <button className={styles.pageBtn}>2</button>
              <button className={styles.pageBtn}>3</button>
              <button className={styles.pageBtn}>4</button>
              <button className={styles.pageBtn}>5</button>
              <button className={styles.pageBtn}>6</button>
              <button className={styles.pageBtn}>7</button>
              <button className={styles.pageBtn}>8</button>
              <button className={styles.pageBtn}>9</button>
              <button className={styles.pageBtn}>»</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
