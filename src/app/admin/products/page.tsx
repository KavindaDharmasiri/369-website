'use client'
import styles from './products.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { decryptData } from '@/lib/clientEncryption'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import Swal from 'sweetalert2'

export default function AdminProducts() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
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
    fetchProducts()
  }, [router])

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.data) {
        const decrypted = decryptData(data.data)
        setProducts(decrypted.products || [])
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
      setProducts([])
    }
  }

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
                <span>Products</span>
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
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>No products found</td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id}>
                      <td><span className={styles.badge}>{product.prodType}</span></td>
                      <td>{product.prodName}</td>
                      <td>{product.prodCategoryName}</td>
                      <td>{product.prodSubCategoryName}</td>
                      <td><span className={product.prodMarket === 'MARKETPLACE' ? styles.marketBadge : styles.draftBadge}>{product.prodMarket === 'MARKETPLACE' ? 'Marketplace' : 'Draft Market'}</span></td>
                      <td><span className={product.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive}>{product.status}</span></td>
                      <td>LKR {product.prodPrice}</td>
                      <td>{new Date(product.createdAt).toLocaleString()}</td>
                      <td>
                        <button className={styles.actionBtn} onClick={() => router.push(`/admin/products/add?id=${product.id}&mode=view`)} title="View">◎</button>
                        <button className={styles.actionBtn} onClick={() => router.push(`/admin/products/add?id=${product.id}&mode=edit`)} title="Edit">✎</button>
                        <button className={styles.actionBtn} onClick={async () => {
                          const result = await Swal.fire({
                            title: 'Delete Product',
                            text: `Are you sure you want to delete ${product.prodName}?`,
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#d33',
                            cancelButtonColor: '#3085d6',
                            confirmButtonText: 'Delete'
                          })
                          
                          if (result.isConfirmed) {
                            try {
                              const token = localStorage.getItem('authToken')
                              const res = await fetch(`/api/products/${product.id}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                              })
                              
                              if (res.ok) {
                                Swal.fire('Deleted!', 'Product has been deleted.', 'success')
                                fetchProducts()
                              } else {
                                Swal.fire('Error!', 'Failed to delete product.', 'error')
                              }
                            } catch (error) {
                              Swal.fire('Error!', 'Failed to delete product.', 'error')
                            }
                          }
                        }} title="Delete">✕</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
