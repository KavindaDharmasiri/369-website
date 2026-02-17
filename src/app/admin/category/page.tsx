'use client'
import styles from './category.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, getAuthToken } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import toast, { Toaster } from 'react-hot-toast'
import { encryptData, decryptData } from '@/lib/clientEncryption'

interface Category {
  id: number
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

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
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [nameError, setNameError] = useState('')
  const [descError, setDescError] = useState('')
  const [viewModal, setViewModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [perPage, setPerPage] = useState(5)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser || authUser.userType !== 'admin') {
      router.push('/signin')
      return
    }
    setUser(authUser)
    fetchCategories()
  }, [router])

  useEffect(() => {
    if (user) {
      setCurrentPage(1)
      fetchCategories()
    }
  }, [activeOnly, user])

  const fetchCategories = async () => {
    try {
      const token = getAuthToken()
      const params = new URLSearchParams()
      if (categoryName) params.append('name', categoryName)
      if (categoryDesc) params.append('description', categoryDesc)
      params.append('activeOnly', activeOnly.toString())

      const res = await fetch(`/api/categories?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      const decrypted = decryptData(data.data)
      if (decrypted.categories) setCategories(decrypted.categories)
    } catch (error) {
      toast.error('Failed to load categories')
    }
  }

  const validateForm = () => {
    let valid = true
    setNameError('')
    setDescError('')

    if (!newCategoryName.trim()) {
      setNameError('Category name is required')
      valid = false
    } else if (newCategoryName.trim().length < 2) {
      setNameError('Category name must be at least 2 characters')
      valid = false
    }

    if (newCategoryDesc.trim() && newCategoryDesc.trim().length < 10) {
      setDescError('Description must be at least 10 characters')
      valid = false
    }

    return valid
  }

  const handleAddCategory = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const token = getAuthToken()
      const encrypted = encryptData({ name: newCategoryName, description: newCategoryDesc, isActive: newCategoryActive })
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ data: encrypted })
      })

      const data = await res.json()
      const decrypted = decryptData(data.data)

      if (res.ok) {
        toast.success('Category added successfully!')
        setShowModal(false)
        setNewCategoryName('')
        setNewCategoryDesc('')
        setNewCategoryActive(true)
        setNameError('')
        setDescError('')
        fetchCategories()
      } else {
        toast.error(decrypted.error || 'Failed to add category')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setNewCategoryName('')
    setNewCategoryDesc('')
    setNewCategoryActive(true)
    setNameError('')
    setDescError('')
  }

  const handleView = (category: Category) => {
    console.log('View clicked:', category)
    setSelectedCategory(category)
    setViewModal(true)
  }

  const handleEdit = (category: Category) => {
    console.log('Edit clicked:', category)
    setSelectedCategory(category)
    setNewCategoryName(category.name)
    setNewCategoryDesc(category.description || '')
    setNewCategoryActive(category.isActive)
    setEditModal(true)
  }

  const handleUpdate = async () => {
    if (!validateForm() || !selectedCategory) return

    setLoading(true)
    try {
      const token = getAuthToken()
      const encrypted = encryptData({ name: newCategoryName, description: newCategoryDesc, isActive: newCategoryActive })
      const res = await fetch(`/api/categories/${selectedCategory.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ data: encrypted })
      })

      const data = await res.json()
      const decrypted = decryptData(data.data)

      if (res.ok) {
        toast.success('Category updated successfully!')
        setEditModal(false)
        setNewCategoryName('')
        setNewCategoryDesc('')
        setNewCategoryActive(true)
        setNameError('')
        setDescError('')
        fetchCategories()
      } else {
        toast.error(decrypted.error || 'Failed to update category')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (category: Category) => {
    console.log('Delete clicked:', category)
    setSelectedCategory(category)
    setDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!selectedCategory) return

    setLoading(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/categories/${selectedCategory.id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      const decrypted = decryptData(data.data)

      if (res.ok) {
        toast.success('Category deleted successfully!')
        setDeleteModal(false)
        fetchCategories()
      } else {
        toast.error(decrypted.error || 'Failed to delete category')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  const totalPages = Math.ceil(categories.length / perPage)
  const startIndex = (currentPage - 1) * perPage
  const endIndex = startIndex + perPage
  const paginatedCategories = categories.slice(startIndex, endIndex)

  return (
    <div className={styles.container}>
      <Toaster position="top-right" />
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
              onKeyUp={fetchCategories}
            />
            <input 
              type="text" 
              placeholder="Category description"
              className={styles.filterInput}
              value={categoryDesc}
              onChange={(e) => setCategoryDesc(e.target.value)}
              onKeyUp={fetchCategories}
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
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                      No categories found
                    </td>
                  </tr>
                ) : (
                  paginatedCategories.map((category) => (
                    <tr key={category.id}>
                      <td>{category.name}</td>
                      <td>{category.description || '-'}</td>
                      <td>
                        <span className={category.isActive ? styles.statusActive : styles.statusInactive}>
                          {category.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td>
                        <button className={styles.actionBtn} onClick={() => handleView(category)} title="View">👁</button>
                        <button className={styles.actionBtn} onClick={() => handleEdit(category)} title="Edit">✎</button>
                        <button className={styles.actionBtn} onClick={() => handleDeleteClick(category)} title="Delete">✕</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <span>Show</span>
            <select className={styles.pageSelect} value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
            <span>per page</span>
            <span className={styles.recordCount}>{startIndex + 1}-{Math.min(endIndex, categories.length)}/{categories.length} Records</span>
            <div className={styles.pageButtons}>
              <button className={styles.pageBtn} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>«</button>
              <button className={styles.pageBtn}>{currentPage}</button>
              <button className={styles.pageBtn} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>»</button>
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
                    className={`${styles.input} ${nameError ? styles.inputError : ''}`}
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value)
                      setNameError('')
                    }}
                  />
                  {nameError && <span className={styles.errorText}>{nameError}</span>}
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
                  placeholder="Enter description (min 10 characters)"
                  className={`${styles.textarea} ${descError ? styles.inputError : ''}`}
                  rows={4}
                  value={newCategoryDesc}
                  onChange={(e) => {
                    setNewCategoryDesc(e.target.value)
                    setDescError('')
                  }}
                />
                {descError && <span className={styles.errorText}>{descError}</span>}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.resetBtn} onClick={handleReset}>Reset</button>
              <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button className={styles.addCategoryBtn} onClick={handleAddCategory} disabled={loading}>
                {loading ? 'Adding...' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewModal && selectedCategory && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>View Category</h2>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.viewField}>
                <label>Category Name</label>
                <p>{selectedCategory.name}</p>
              </div>
              <div className={styles.viewField}>
                <label>Status</label>
                <p>{selectedCategory.isActive ? 'Active' : 'Inactive'}</p>
              </div>
              <div className={styles.viewField}>
                <label>Description</label>
                <p>{selectedCategory.description || '-'}</p>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setViewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editModal && selectedCategory && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Edit Category</h2>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label>Category name</label>
                  <input 
                    type="text" 
                    placeholder="Enter Category name"
                    className={`${styles.input} ${nameError ? styles.inputError : ''}`}
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value)
                      setNameError('')
                    }}
                  />
                  {nameError && <span className={styles.errorText}>{nameError}</span>}
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
                  placeholder="Enter description (min 10 characters)"
                  className={`${styles.textarea} ${descError ? styles.inputError : ''}`}
                  rows={4}
                  value={newCategoryDesc}
                  onChange={(e) => {
                    setNewCategoryDesc(e.target.value)
                    setDescError('')
                  }}
                />
                {descError && <span className={styles.errorText}>{descError}</span>}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setEditModal(false)}>Cancel</button>
              <button className={styles.addCategoryBtn} onClick={handleUpdate} disabled={loading}>
                {loading ? 'Updating...' : 'Update Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && selectedCategory && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Delete Category</h2>
            </div>
            <div className={styles.modalContent}>
              <p>Are you sure you want to delete <strong>{selectedCategory.name}</strong>?</p>
              <p className={styles.warningText}>This action cannot be undone.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setDeleteModal(false)}>Cancel</button>
              <button className={styles.deleteBtn} onClick={handleDelete} disabled={loading}>
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
