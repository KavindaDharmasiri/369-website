'use client'
import styles from './sku.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function GeneratedSKU() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser || authUser.userType !== 'admin') {
      router.push('/signin')
      return
    }
    setUser(authUser)
  }, [router])

  if (!user) return null

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.pageTitle}>Product</h1>
              <div className={styles.breadcrumb}>
                <Link href="/admin" className={styles.breadcrumbLink}>Dashboard</Link>
                <span className={styles.separator}>/</span>
                <Link href="/admin/products" className={styles.breadcrumbLink}>Products</Link>
                <span className={styles.separator}>/</span>
                <Link href="/admin/products/specifications" className={styles.breadcrumbLink}>Specifications</Link>
                <span className={styles.separator}>/</span>
                <span>Generated SKU</span>
              </div>
            </div>
          </div>

          <h2 className={styles.sectionTitle}>Generated SKU Table</h2>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Id</th>
                  <th>SKU Code</th>
                  <th>Variant Details</th>
                  <th>Price</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>3940</td>
                  <td>BAB/BAT/000094-VOL-VOL</td>
                  <td>volume, volume</td>
                  <td>LKR 0</td>
                  <td>
                    <button className={styles.actionBtn}>◎</button>
                    <button className={styles.actionBtn}>✎</button>
                  </td>
                </tr>
                <tr>
                  <td>3941</td>
                  <td>BAB/BAT/000094-VOL-VOL</td>
                  <td>volume, volume</td>
                  <td>LKR 0</td>
                  <td>
                    <button className={styles.actionBtn}>◎</button>
                    <button className={styles.actionBtn}>✎</button>
                  </td>
                </tr>
                <tr>
                  <td>3942</td>
                  <td>BAB/BAT/000094-VOL-VOL</td>
                  <td>volume, volume</td>
                  <td>LKR 0</td>
                  <td>
                    <button className={styles.actionBtn}>◎</button>
                    <button className={styles.actionBtn}>✎</button>
                  </td>
                </tr>
                <tr>
                  <td>3943</td>
                  <td>BAB/BAT/000094-VOL-VOL</td>
                  <td>volume, volume</td>
                  <td>LKR 0</td>
                  <td>
                    <button className={styles.actionBtn}>◎</button>
                    <button className={styles.actionBtn}>✎</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.actions}>
            <button className={styles.publishBtn}>▢ Publish</button>
            <button className={styles.finishBtn}>Finish</button>
          </div>
        </div>
      </main>
    </div>
  )
}
