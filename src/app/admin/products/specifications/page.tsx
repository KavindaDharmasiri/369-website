'use client'
import styles from './specifications.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function ProductSpecifications() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [attributes, setAttributes] = useState([{ name: '', value: '', type: 'text' }])

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
                <Link href="/admin/products/specifications" className={styles.breadcrumbLink}>Product Specifications</Link>
              </div>
            </div>
            <button className={styles.addBtn} onClick={() => setShowModal(true)}>+ Add Specifications</button>
          </div>

          <h2 className={styles.sectionTitle}>Specification</h2>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order No.</th>
                  <th>Specifications Name</th>
                  <th>Specifications Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>Blue</td>
                  <td>The bule mist</td>
                  <td>
                    <button className={styles.actionBtn}>👁</button>
                    <button className={styles.actionBtn}>✏️</button>
                  </td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>Gold</td>
                  <td>The gold mist</td>
                  <td>
                    <button className={styles.actionBtn}>👁</button>
                    <button className={styles.actionBtn}>✏️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.actions}>
            <button className={styles.updateBtn} onClick={() => router.push('/admin/products/sku')}>✏️ Update & Next</button>
            <button className={styles.nextBtn}>→ Next</button>
          </div>
        </div>
      </main>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Product Specification</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.section}>
                <h3>Specification</h3>
                
                <div className={styles.field}>
                  <label>Name</label>
                  <input type="text" placeholder="Enter Specification Name" className={styles.input} />
                </div>
                
                <div className={styles.field}>
                  <label>Description</label>
                  <textarea placeholder="Type Here..." className={styles.textarea} rows={4} />
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3>Attributes</h3>
                  <button className={styles.addAttrBtn} onClick={() => setAttributes([...attributes, { name: '', value: '', type: 'text' }])}>+ Add</button>
                </div>
                
                {attributes.map((attr, index) => (
                  <div key={index} className={styles.attrRow}>
                    <input type="text" placeholder="Attribute Name" className={styles.input} />
                    <select 
                      className={styles.select}
                      value={attr.type}
                      onChange={(e) => {
                        const newAttrs = [...attributes]
                        newAttrs[index].type = e.target.value
                        setAttributes(newAttrs)
                      }}
                    >
                      <option value="text">Text</option>
                      <option value="color">Color</option>
                    </select>
                    {attr.type === 'color' ? (
                      <input type="color" className={styles.colorInput} />
                    ) : (
                      <input type="text" placeholder="Attribute Value" className={styles.input} />
                    )}
                    <button className={styles.deleteBtn} onClick={() => setAttributes(attributes.filter((_, i) => i !== index))}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.closeModalBtn} onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
