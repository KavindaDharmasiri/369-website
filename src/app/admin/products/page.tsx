'use client'
import styles from './products.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, removeAuthToken } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function AdminProducts() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [productName, setProductName] = useState('')
  const [productType, setProductType] = useState('All')
  const [addedDate, setAddedDate] = useState('')

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
                <Link href="/admin" className={styles.breadcrumbLink}>Product Management</Link>
                <span className={styles.separator}>/</span>
                <span>Product</span>
              </div>
            </div>
            <button className={styles.addBtn} onClick={() => router.push('/admin/products/add')}>+ Add Product</button>
          </div>
          
          <h2 className={styles.sectionTitle}>All Products</h2>
          
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Product Name</label>
              <input 
                type="text" 
                placeholder="Product Name"
                className={styles.filterInput}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>
            
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Product Type</label>
              <select 
                className={styles.filterSelect}
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
              >
                <option>All</option>
                <option>Women</option>
                <option>Men</option>
              </select>
            </div>
            
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Added Date</label>
              <input 
                type="text" 
                placeholder="mm/dd/yyyy"
                className={styles.filterInput}
                value={addedDate}
                onChange={(e) => setAddedDate(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product Type</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Sub Category</th>
                  <th>Product Market</th>
                  <th>Product Status</th>
                  <th>Product Price</th>
                  <th>Created At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className={styles.badge}>Product</span></td>
                  <td>ECLAT</td>
                  <td>Baby Care</td>
                  <td>Bath & Body</td>
                  <td><span className={styles.marketBadge}>Marketplace</span></td>
                  <td><span className={styles.statusActive}>ACTIVE</span></td>
                  <td>LKR 7599.99</td>
                  <td>12/29/25, 9:20 AM</td>
                  <td>
                    <button className={styles.actionBtn}>👁</button>
                    <button className={styles.actionBtn}>✏️</button>
                    <button className={styles.actionBtn}>🗑️</button>
                  </td>
                </tr>
                <tr>
                  <td><span className={styles.badge}>Product</span></td>
                  <td>hhh</td>
                  <td>Skin Wellness</td>
                  <td>Eye Care</td>
                  <td><span className={styles.marketBadge}>Marketplace</span></td>
                  <td><span className={styles.statusActive}>ACTIVE</span></td>
                  <td>LKR 1000</td>
                  <td>12/29/25, 8:36 AM</td>
                  <td>
                    <button className={styles.actionBtn}>👁</button>
                    <button className={styles.actionBtn}>✏️</button>
                    <button className={styles.actionBtn}>🗑️</button>
                  </td>
                </tr>
                <tr>
                  <td><span className={styles.badge}>Product</span></td>
                  <td>body lotion</td>
                  <td>Skin</td>
                  <td>skin blue</td>
                  <td><span className={styles.draftBadge}>Draft Market</span></td>
                  <td><span className={styles.statusActive}>ACTIVE</span></td>
                  <td>LKR 2000</td>
                  <td>3/27/25, 3:34 AM</td>
                  <td>
                    <button className={styles.actionBtn}>👁</button>
                    <button className={styles.actionBtn}>✏️</button>
                    <button className={styles.actionBtn}>🗑️</button>
                  </td>
                </tr>
                <tr>
                  <td><span className={styles.badge}>Product</span></td>
                  <td>Amora</td>
                  <td>Perfume</td>
                  <td>Ladies Perfume</td>
                  <td><span className={styles.marketBadge}>Marketplace</span></td>
                  <td><span className={styles.statusActive}>ACTIVE</span></td>
                  <td>LKR 2000</td>
                  <td>3/6/25, 7:52 AM</td>
                  <td>
                    <button className={styles.actionBtn}>👁</button>
                    <button className={styles.actionBtn}>✏️</button>
                    <button className={styles.actionBtn}>🗑️</button>
                  </td>
                </tr>
                <tr>
                  <td><span className={styles.badge}>Product</span></td>
                  <td>Royal Lotus Body Spray</td>
                  <td>Skin Wellness</td>
                  <td>Face Care</td>
                  <td><span className={styles.marketBadge}>Marketplace</span></td>
                  <td><span className={styles.statusActive}>ACTIVE</span></td>
                  <td>LKR 3900</td>
                  <td>2/27/25, 4:54 AM</td>
                  <td>
                    <button className={styles.actionBtn}>👁</button>
                    <button className={styles.actionBtn}>✏️</button>
                    <button className={styles.actionBtn}>🗑️</button>
                  </td>
                </tr>
                <tr>
                  <td colSpan={9}>
                    <div className={styles.pagination}>
                      <span>Show</span>
                      <select className={styles.pageSelect}>
                        <option>5</option>
                        <option>10</option>
                        <option>25</option>
                      </select>
                      <span>per page</span>
                      <span className={styles.recordCount}>0/13 Records</span>
                      <div className={styles.pageButtons}>
                        <button className={styles.pageBtn}>«</button>
                        <button className={styles.pageBtn}>1</button>
                        <button className={styles.pageBtn}>2</button>
                        <button className={styles.pageBtn}>3</button>
                        <button className={styles.pageBtn}>»</button>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
