'use client'
import styles from './add.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function AddProduct() {
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
              <h1 className={styles.pageTitle}>Add Product</h1>
              <div className={styles.breadcrumb}>
                <Link href="/admin" className={styles.breadcrumbLink}>Product Management</Link>
                <span className={styles.separator}>/</span>
                <Link href="/admin/products" className={styles.breadcrumbLink}>Product</Link>
                <span className={styles.separator}>/</span>
                <span>Add Product</span>
              </div>
            </div>
          </div>

          <form className={styles.form}>
            <div className={styles.topRow}>
              <div className={styles.field}>
                <label>Product Status</label>
                <select className={styles.select}>
                  <option>ACTIVE</option>
                  <option>INACTIVE</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Stock Status</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radio}>
                    <input type="radio" name="stock" defaultChecked />
                    <span>In Stock</span>
                  </label>
                </div>
              </div>
              <div className={styles.field}>
                <label>Marketplace</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radio}>
                    <input type="radio" name="marketplace" defaultChecked />
                    <span>Publish</span>
                  </label>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Product Details</h2>
              
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Product Type</label>
                  <select className={styles.select}>
                    <option>Product</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Category</label>
                  <select className={styles.select}>
                    <option>Baby Care</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Subcategory</label>
                  <select className={styles.select}>
                    <option>Bath & Body</option>
                  </select>
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Product Name/Title</label>
                  <input type="text" className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label>Product Subtitle</label>
                  <input type="text" placeholder="Product Subtitle" className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label>Product Description</label>
                  <input type="text" placeholder="Product description" className={styles.input} />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Product Image</label>
                  <input type="file" className={styles.fileInput} />
                </div>
                <div className={styles.field}>
                  <label>Product Price (RS)</label>
                  <input type="number" placeholder="0" className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label>Charge Tax on Product</label>
                  <label className={styles.checkbox}>
                    <input type="checkbox" />
                    <span>Charge TAX</span>
                  </label>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Tags</h2>
              
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Category Tags</label>
                  <input type="text" placeholder="Add category" className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label>Meta Tags</label>
                  <input type="text" placeholder="Add meta tags" className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label>GA-4 Meta Tags</label>
                  <input type="text" placeholder="Add GA-4 meta mags" className={styles.input} />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Product Visibility</h2>
              
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Page</label>
                  <select className={styles.select}>
                    <option>Dashboard</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Section</label>
                  <select className={styles.select}>
                    <option>Top Products</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Return Policy</h2>
              
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Return Policy</label>
                  <input type="file" className={styles.fileInput} />
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" onClick={() => router.push('/admin/products/specifications')} className={styles.submitBtn}>💾 Save as Draft & Next</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
