'use client'
import styles from './subcategory.module.css'
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
}

interface SubCategory {
  id: number
  name: string
  description: string | null
  categoryId: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  category: Category
}

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
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [subcategories, setSubcategories] = useState<SubCategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [nameError, setNameError] = useState('')
  const [descError, setDescError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [viewModal, setViewModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null)
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
    fetchSubcategories()
  }, [router])

  useEffect(() => {
    if (user) {
      setCurrentPage(1)
      fetchSubcategories()
    }
  }, [activeOnly, user])

  const fetchCategories = async () => {
    try {
      const token = getAuthToken()
      const res = await fetch('/api/categories?activeOnly=true', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      const decrypted = decryptData(data.data)
      if (decrypted.categories) setCategories(decrypted.categories)
    } catch (error) {
      toast.error('Failed to load categories')
    }
  }

  const fetchSubcategories = async () => {
    try {
      const token = getAuthToken()
      const params = new URLSearchParams()
      if (subCategoryName) params.append('name', subCategoryName)
      if (subCategoryDesc) params.append('description', subCategoryDesc)
      params.append('activeOnly', activeOnly.toString())

      const res = await fetch(`/api/subcategories?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      const decrypted = decryptData(data.data)
      if (decrypted.subcategories) setSubcategories(decrypted.subcategories)
    } catch (error) {
      toast.error('Failed to load sub categories')
    }
  }

  const validateForm = () => {
    let valid = true
    setNameError('')
    setDescError('')
    setCategoryError('')

    if (!newSubCategoryName.trim()) {
      setNameError('Sub category name is required')
      valid = false
    } else if (newSubCategoryName.trim().length < 2) {
      setNameError('Sub category name must be at least 2 characters')
      valid = false
    }

    if (!selectedCategoryId) {
      setCategoryError('Category is required')
      valid = false
    }

    if (newSubCategoryDesc.trim() && newSubCategoryDesc.trim().length < 10) {
      setDescError('Description must be at least 10 characters')
      valid = false
    }

    return valid
  }

  const handleAddSubCategory = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const token = getAuthToken()
      const encrypted = encryptData({ 
        name: newSubCategoryName, 
        description: newSubCategoryDesc, 
        categoryId: selectedCategoryId,
        isActive: newSubCategoryActive 
      })
      const res = await fetch('/api/subcategories', {
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
        toast.success('Sub category added successfully!')
        setShowModal(false)
        handleReset()
        fetchSubcategories()
      } else {
        toast.error(decrypted.error || 'Failed to add sub category')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setNewSubCategoryName('')
    setNewSubCategoryDesc('')
    setNewSubCategoryActive(true)
    setSelectedCategoryId('')
    setNameError('')
    setDescError('')
    setCategoryError('')
  }

  const handleView = (subcategory: SubCategory) => {
    setSelectedSubCategory(subcategory)
    setViewModal(true)
  }

  const handleEdit = (subcategory: SubCategory) => {
    setSelectedSubCategory(subcategory)
    setNewSubCategoryName(subcategory.name)
    setNewSubCategoryDesc(subcategory.description || '')
    setNewSubCategoryActive(subcategory.isActive)
    setSelectedCategoryId(subcategory.categoryId.toString())
    setEditModal(true)
  }

  const handleUpdate = async () => {
    if (!validateForm() || !selectedSubCategory) return

    setLoading(true)
    try {
      const token = getAuthToken()
      const encrypted = encryptData({ 
        name: newSubCategoryName, 
        description: newSubCategoryDesc, 
        categoryId: selectedCategoryId,
        isActive: newSubCategoryActive 
      })
      const res = await fetch(`/api/subcategories/${selectedSubCategory.id}`, {
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
        toast.success('Sub category updated successfully!')
        setEditModal(false)
        handleReset()
        fetchSubcategories()
      } else {
        toast.error(decrypted.error || 'Failed to update sub category')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (subcategory: SubCategory) => {
    setSelectedSubCategory(subcategory)
    setDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!selectedSubCategory) return

    setLoading(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/subcategories/${selectedSubCategory.id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      const decrypted = decryptData(data.data)

      if (res.ok) {
        toast.success('Sub category deleted successfully!')
        setDeleteModal(false)
        fetchSubcategories()
      } else {
        toast.error(decrypted.error || 'Failed to delete sub category')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  const totalPages = Math.ceil(subcategories.length / perPage)
  const startIndex = (currentPage - 1) * perPage
  const endIndex = startIndex + perPage
  const paginatedSubcategories = subcategories.slice(startIndex, endIndex)

  return (
    <div className={styles.container}>
      <Toaster position="top-right" />
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

          <h2 className={styles.sectionTitle}>All Sub Categories</h2>

          <div className={styles.filters}>
            <input 
              type="text" 
              placeholder="Sub category name"
              className={styles.filterInput}
              value={subCategoryName}
              onChange={(e) => setSubCategoryName(e.target.value)}
              onKeyUp={fetchSubcategories}
            />
            <input 
              type="text" 
              placeholder="Sub category description"
              className={styles.filterInput}
              value={subCategoryDesc}
              onChange={(e) => setSubCategoryDesc(e.target.value)}
              onKeyUp={fetchSubcategories}
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
                  <th>Category</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {subcategories.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                      No sub categories found
                    </td>
                  </tr>
                ) : (
                  paginatedSubcategories.map((subcategory) => (
                    <tr key={subcategory.id}>
                      <td>{subcategory.name}</td>
                      <td>{subcategory.category.name}</td>
                      <td>{subcategory.description || '-'}</td>
                      <td>
                        <span className={subcategory.isActive ? styles.statusActive : styles.statusInactive}>
                          {subcategory.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td>
                        <button className={styles.actionBtn} onClick={() => handleView(subcategory)} title="View">👁</button>
                        <button className={styles.actionBtn} onClick={() => handleEdit(subcategory)} title="Edit">✎</button>
                        <button className={styles.actionBtn} onClick={() => handleDeleteClick(subcategory)} title="Delete">✕</button>
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
            <span className={styles.recordCount}>{startIndex + 1}-{Math.min(endIndex, subcategories.length)}/{subcategories.length} Records</span>
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
              <h2>Add New Sub Category</h2>
            </div>

            <div className={styles.modalContent}>
              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label>Sub Category Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter Sub Category name"
                    className={`${styles.input} ${nameError ? styles.inputError : ''}`}
                    value={newSubCategoryName}
                    onChange={(e) => {
                      setNewSubCategoryName(e.target.value)
                      setNameError('')
                    }}
                  />
                  {nameError && <span className={styles.errorText}>{nameError}</span>}
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
                  <label>Description</label>
                  <textarea 
                    placeholder="Enter description (min 10 characters)"
                    className={`${styles.textarea} ${descError ? styles.inputError : ''}`}
                    rows={4}
                    value={newSubCategoryDesc}
                    onChange={(e) => {
                      setNewSubCategoryDesc(e.target.value)
                      setDescError('')
                    }}
                  />
                  {descError && <span className={styles.errorText}>{descError}</span>}
                </div>
                <div className={styles.formField}>
                  <label>Category</label>
                  <select 
                    className={`${styles.select} ${categoryError ? styles.inputError : ''}`}
                    value={selectedCategoryId}
                    onChange={(e) => {
                      setSelectedCategoryId(e.target.value)
                      setCategoryError('')
                    }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  {categoryError && <span className={styles.errorText}>{categoryError}</span>}
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.resetBtn} onClick={handleReset}>Reset</button>
              <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button className={styles.addSubCategoryBtn} onClick={handleAddSubCategory} disabled={loading}>
                {loading ? 'Adding...' : 'Add Sub Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewModal && selectedSubCategory && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>View Sub Category</h2>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.viewField}>
                <label>Sub Category Name</label>
                <p>{selectedSubCategory.name}</p>
              </div>
              <div className={styles.viewField}>
                <label>Category</label>
                <p>{selectedSubCategory.category.name}</p>
              </div>
              <div className={styles.viewField}>
                <label>Status</label>
                <p>{selectedSubCategory.isActive ? 'Active' : 'Inactive'}</p>
              </div>
              <div className={styles.viewField}>
                <label>Description</label>
                <p>{selectedSubCategory.description || '-'}</p>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setViewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editModal && selectedSubCategory && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Edit Sub Category</h2>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label>Sub Category Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter Sub Category name"
                    className={`${styles.input} ${nameError ? styles.inputError : ''}`}
                    value={newSubCategoryName}
                    onChange={(e) => {
                      setNewSubCategoryName(e.target.value)
                      setNameError('')
                    }}
                  />
                  {nameError && <span className={styles.errorText}>{nameError}</span>}
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
                  <label>Description</label>
                  <textarea 
                    placeholder="Enter description (min 10 characters)"
                    className={`${styles.textarea} ${descError ? styles.inputError : ''}`}
                    rows={4}
                    value={newSubCategoryDesc}
                    onChange={(e) => {
                      setNewSubCategoryDesc(e.target.value)
                      setDescError('')
                    }}
                  />
                  {descError && <span className={styles.errorText}>{descError}</span>}
                </div>
                <div className={styles.formField}>
                  <label>Category</label>
                  <select 
                    className={`${styles.select} ${categoryError ? styles.inputError : ''}`}
                    value={selectedCategoryId}
                    onChange={(e) => {
                      setSelectedCategoryId(e.target.value)
                      setCategoryError('')
                    }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  {categoryError && <span className={styles.errorText}>{categoryError}</span>}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setEditModal(false)}>Cancel</button>
              <button className={styles.addSubCategoryBtn} onClick={handleUpdate} disabled={loading}>
                {loading ? 'Updating...' : 'Update Sub Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && selectedSubCategory && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Delete Sub Category</h2>
            </div>
            <div className={styles.modalContent}>
              <p>Are you sure you want to delete <strong>{selectedSubCategory.name}</strong>?</p>
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
