'use client'
import styles from './category.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function CategoryManagement() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [categoryName, setCategoryName] = useState('')
  const [categoryDesc, setCategoryDesc] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryDesc, setNewCategoryDesc] = useState('')
  const [newCategoryActive, setNewCategoryActive] = useState(true)

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser || authUser.userType !== 'admin') {
      router.push('/signin')
      return
    }
    setUser(authUser)
  }, [router])

  if (!user) return null

  const categories = [
    { name: 'Baby Care', description: 'High-quality universal newborn health care is the right of every newborn everywhere. Babies have the right to be protected from injury and infection.' },
    { name: 'Skin Wellness', description: 'Skin wellness is a combination of lifestyle habits and skincare products that promote healthy skin. Healthy skin is smooth, warm, and not dry or flaky.' },
    { name: 'Hair Wellness', description: 'Hair wellness is a holistic approach to hair care that considers the health of your scalp and hair, as well as your overall well-being. It involves practices that can help you reduce stress, eat well, and care for your scalp.' },
    { name: 'Home Wellness', description: 'Home wellness is the practice of creating a healthy and balanced home environment that promotes physical, mental, and emotional well-being. It involves making choices that support your health and vitality.' },
    { name: 'Fragrances', description: 'A fragrance is a combination of organic compounds that produce a pleasant smell. Fragrances are used in many products, including cosmetics, toiletries, and air fresheners.' },
    { name: 'Perfume', description: 'Perfumes for ladies & gents with local & international brands' },
    { name: 'Skin', description: 'Skin wellness description' }
  ]

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.pageTitle}>Category Management</h1>
              <div className={styles.breadcrumb}>
                <Link href="/admin" className={styles.breadcrumbLink}>Dashboard</Link>
                <span className={styles.separator}>/</span>
                <span>Category</span>
              </div>
            </div>
            <button className={styles.addBtn} onClick={() => setShowModal(true)}>+ Add New Category</button>
          </div>

          <h2 className={styles.sectionTitle}>All Categories</h2>

          <div className={styles.filters}>
            <input 
              type="text" 
              placeholder="Category name"
              className={styles.filterInput}
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
            <input 
              type="text" 
              placeholder="Category description"
              className={styles.filterInput}
              value={categoryDesc}
              onChange={(e) => setCategoryDesc(e.target.value)}
            />
            <label className={styles.toggleLabel}>
              <input 
                type="checkbox" 
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className={styles.toggle}
              />
              <span>Active Category</span>
            </label>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category, index) => (
                  <tr key={index}>
                    <td>{category.name}</td>
                    <td>{category.description}</td>
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
            <span className={styles.recordCount}>0/7 Records</span>
            <div className={styles.pageButtons}>
              <button className={styles.pageBtn}>«</button>
              <button className={styles.pageBtn}>1</button>
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
                <h2>Add New Category</h2>
                <div className={styles.breadcrumb}>
                  <Link href="/admin" className={styles.breadcrumbLink}>Dashboard</Link>
                  <span className={styles.separator}>/</span>
                  <Link href="/admin/category" className={styles.breadcrumbLink}>Category</Link>
                  <span className={styles.separator}>/</span>
                  <span>Add New Category</span>
                </div>
              </div>
            </div>

            <div className={styles.modalContent}>
              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label>Category name</label>
                  <input 
                    type="text" 
                    placeholder="Enter Category name"
                    className={styles.input}
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                </div>
                <div className={styles.formField}>
                  <label>Category Status</label>
                  <label className={styles.toggleLabel}>
                    <input 
                      type="checkbox" 
                      checked={newCategoryActive}
                      onChange={(e) => setNewCategoryActive(e.target.checked)}
                      className={styles.toggle}
                    />
                    <span>Active</span>
                  </label>
                </div>
              </div>

              <div className={styles.formField}>
                <label>Description</label>
                <textarea 
                  placeholder="Enter description"
                  className={styles.textarea}
                  rows={4}
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.resetBtn}>Reset</button>
              <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button className={styles.addCategoryBtn}>Add Category</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
