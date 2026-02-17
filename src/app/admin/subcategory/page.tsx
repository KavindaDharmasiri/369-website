'use client'
import styles from './subcategory.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function SubCategoryManagement() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [subCategoryName, setSubCategoryName] = useState('')
  const [subCategoryDesc, setSubCategoryDesc] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newSubCategoryName, setNewSubCategoryName] = useState('')
  const [newSubCategoryDesc, setNewSubCategoryDesc] = useState('')
  const [newSubCategoryActive, setNewSubCategoryActive] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('')

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser || authUser.userType !== 'admin') {
      router.push('/signin')
      return
    }
    setUser(authUser)
  }, [router])

  if (!user) return null

  const subcategories = [
    { name: 'Bath & Body', description: 'Bath & Body Works, a global leader in personal care and home fragrance, became independent in August 2021. Its bestsellers include fragrances, lotions, candles, and home diffusers.' },
    { name: 'Baby Toys', description: 'Baby toys can help babies develop their senses, motor skills, and cognitive abilities. Some popular baby toys include:' },
    { name: 'Lip Care', description: 'Lip care refers to the practice of regularly applying moisturizing products like lip balm to protect and hydrate lips, keeping them soft and smooth by preventing dryness,' },
    { name: 'Eye Care', description: 'AI Overview Learn more "Eye care" refers to the practice of maintaining healthy eyes by taking preventative measures like regular eye exams, wearing sunglasses, and a balanced diet, to detect and treat potential vision problems or eye diseases early on' },
    { name: 'Face Care', description: 'Face care refers to a routine of cleansing, moisturizing, and protecting the facial skin through practices like washing, applying sunscreen, and using specialized products based on your skin type to maintain a healthy' },
    { name: 'Conditioners', description: 'A conditioner is a product, typically used after shampooing, that rehydrates and smooths hair, leaving it soft and manageable by restoring moisture lost during cleansing' },
    { name: 'Treatment Oils', description: 'Treatment Oils is Best' },
    { name: 'Hair Treatment Masques', description: 'Hair Treatment Masques is Best Choise' },
    { name: 'Essential Oil', description: 'An essential oil is a highly concentrated, volatile liquid extracted from plants, capturing the plant\'s distinctive scent and flavor, often used in aromatherapy for its potential therapeutic benefits' },
    { name: 'Incense Sticks', description: 'Incense Sticks is Best Sub Category Product' }
  ]

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.pageTitle}>Sub Category Management</h1>
              <div className={styles.breadcrumb}>
                <Link href="/admin" className={styles.breadcrumbLink}>Dashboard</Link>
                <span className={styles.separator}>/</span>
                <span>Sub Category</span>
              </div>
            </div>
            <button className={styles.addBtn} onClick={() => setShowModal(true)}>+ Add New Sub Category</button>
          </div>

          <h2 className={styles.sectionTitle}>All Categories</h2>

          <div className={styles.filters}>
            <input 
              type="text" 
              placeholder="Sub category name"
              className={styles.filterInput}
              value={subCategoryName}
              onChange={(e) => setSubCategoryName(e.target.value)}
            />
            <input 
              type="text" 
              placeholder="Sub category description"
              className={styles.filterInput}
              value={subCategoryDesc}
              onChange={(e) => setSubCategoryDesc(e.target.value)}
            />
            <label className={styles.toggleLabel}>
              <input 
                type="checkbox" 
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className={styles.toggle}
              />
              <span>Active Sub Category</span>
            </label>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Sub Category Name</th>
                  <th>Sub Category Description</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {subcategories.map((subcategory, index) => (
                  <tr key={index}>
                    <td>{subcategory.name}</td>
                    <td>{subcategory.description}</td>
                    <td><span className={styles.statusActive}>ACTIVE</span></td>
                    <td>
                      <button className={styles.actionBtn}>◎</button>
                      <button className={styles.actionBtn}>✎</button>
                      <button className={styles.actionBtn}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <span>Show</span>
            <select className={styles.pageSelect}>
              <option>5</option>
              <option>10</option>
              <option>25</option>
            </select>
            <span>per page</span>
            <span className={styles.recordCount}>0/14 Records</span>
            <div className={styles.pageButtons}>
              <button className={styles.pageBtn}>«</button>
              <button className={styles.pageBtn}>1</button>
              <button className={styles.pageBtn}>2</button>
              <button className={styles.pageBtn}>»</button>
            </div>
          </div>
        </div>
      </main>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Add New Sub Category</h2>
                <div className={styles.breadcrumb}>
                  <Link href="/admin" className={styles.breadcrumbLink}>Dashboard</Link>
                  <span className={styles.separator}>/</span>
                  <Link href="/admin/subcategory" className={styles.breadcrumbLink}>Sub Category</Link>
                  <span className={styles.separator}>/</span>
                  <span>Add New Sub Category</span>
                </div>
              </div>
            </div>

            <div className={styles.modalContent}>
              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label>Sub Category Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter Sub Category name"
                    className={styles.input}
                    value={newSubCategoryName}
                    onChange={(e) => setNewSubCategoryName(e.target.value)}
                  />
                </div>
                <div className={styles.formField}>
                  <label>Sub Category Status</label>
                  <label className={styles.toggleLabel}>
                    <input 
                      type="checkbox" 
                      checked={newSubCategoryActive}
                      onChange={(e) => setNewSubCategoryActive(e.target.checked)}
                      className={styles.toggle}
                    />
                    <span>Active</span>
                  </label>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label>Sub Category Description</label>
                  <textarea 
                    placeholder="Enter description"
                    className={styles.textarea}
                    rows={4}
                    value={newSubCategoryDesc}
                    onChange={(e) => setNewSubCategoryDesc(e.target.value)}
                  />
                </div>
                <div className={styles.formField}>
                  <label>Category</label>
                  <select 
                    className={styles.select}
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="">Select Category</option>
                    <option value="baby-care">Baby Care</option>
                    <option value="skin-wellness">Skin Wellness</option>
                    <option value="hair-wellness">Hair Wellness</option>
                    <option value="home-wellness">Home Wellness</option>
                    <option value="fragrances">Fragrances</option>
                    <option value="perfume">Perfume</option>
                    <option value="skin">Skin</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.resetBtn}>Reset</button>
              <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button className={styles.addSubCategoryBtn}>Add Sub Category</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
