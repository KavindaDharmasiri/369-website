'use client'
import styles from './discounts.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, getAuthToken } from '@/lib/clientAuth'
import { decryptData } from '@/lib/clientEncryption'
import AdminSidebar from '@/components/AdminSidebar'
import toast, { Toaster } from 'react-hot-toast'
import Swal from 'sweetalert2'
import { X, PenLine, Plus, Trash2, Package, FolderTree, Folder, Search } from 'lucide-react'
import { TableSkeleton } from '@/components/Skeleton'

interface Discount {
  id: number
  name: string
  description: string | null
  discountType: string
  discountValue: string
  scope: string
  productId: number | null
  categoryId: number | null
  subCategoryId: number | null
  product?: any
  category?: any
  subCategory?: any
  isActive: boolean
  validFrom: string | null
  validUntil: string | null
  createdAt: string
}

const emptyForm = {
  name: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  scope: 'product',
  productId: '',
  categoryId: '',
  subCategoryId: '',
  isActive: true,
  validFrom: '',
  validUntil: ''
}

export default function DiscountsManagement() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const [productOpen, setProductOpen] = useState(false)

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser || authUser.userType !== 'admin') {
      router.push('/signin')
      return
    }
    setUser(authUser)
    fetchDiscounts()
    fetchProducts()
    fetchCategories()
    fetchSubcategories()
  }, [router])

  const fetchDiscounts = async () => {
    setLoading(true)
    try {
      const token = getAuthToken()
      const res = await fetch('/api/admin/discounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      if (result.success) {
        setDiscounts(result.data.discounts || [])
      }
    } catch (error) {
      toast.error('Failed to load discounts')
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const token = getAuthToken()
      const res = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      const decrypted = decryptData(result.data)
      const list = decrypted.products || []
      list.sort((a: any, b: any) => a.prodName.localeCompare(b.prodName))
      setProducts(list)
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const result = await res.json()
      const decrypted = decryptData(result.data)
      setCategories(decrypted.categories || [])
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const fetchSubcategories = async () => {
    try {
      const res = await fetch('/api/subcategories')
      const result = await res.json()
      const decrypted = decryptData(result.data)
      setSubcategories(decrypted.subcategories || [])
    } catch (error) {
      console.error('Failed to load subcategories:', error)
    }
  }

  const openAdd = () => {
    setEditId(null)
    setForm({ ...emptyForm })
    setProductQuery('')
    setShowModal(true)
  }

  const openEdit = (discount: Discount) => {
    setEditId(discount.id)
    setForm({
      name: discount.name,
      description: discount.description || '',
      discountType: discount.discountType,
      discountValue: String(discount.discountValue),
      scope: discount.scope,
      productId: discount.productId ? String(discount.productId) : '',
      categoryId: discount.categoryId ? String(discount.categoryId) : '',
      subCategoryId: discount.subCategoryId ? String(discount.subCategoryId) : '',
      isActive: discount.isActive,
      validFrom: discount.validFrom ? discount.validFrom.slice(0, 16) : '',
      validUntil: discount.validUntil ? discount.validUntil.slice(0, 16) : ''
    })
    setProductQuery(discount.product?.prodName || '')
    setShowModal(true)
  }

  const validateForm = () => {
    if (!form.name.trim()) return 'Discount name is required'
    if (!form.discountValue || Number(form.discountValue) <= 0) return 'Discount value must be greater than 0'
    if (form.discountType === 'percentage' && Number(form.discountValue) > 100) return 'Percentage discount cannot exceed 100%'
    if (form.scope === 'product' && !form.productId) return 'Please select a product'
    if (form.scope === 'category' && !form.categoryId) return 'Please select a category'
    if (form.scope === 'subcategory' && !form.subCategoryId) return 'Please select a sub category'
    return ''
  }

  const handleSave = async () => {
    const error = validateForm()
    if (error) {
      Swal.fire({ icon: 'warning', title: 'Validation Error', text: error, confirmButtonColor: '#000' })
      return
    }

    setSaving(true)
    try {
      const token = getAuthToken()
      const payload = {
        ...form,
        discountValue: Number(form.discountValue)
      }

      const res = editId
        ? await fetch(`/api/admin/discounts/${editId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
          })
        : await fetch('/api/admin/discounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
          })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'Failed to save discount')
      }

      toast.success(editId ? 'Discount updated' : 'Discount created')
      setShowModal(false)
      fetchDiscounts()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save discount')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (discount: Discount) => {
    const result = await Swal.fire({
      title: 'Delete Discount?',
      text: `Delete discount "${discount.name}"? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#000',
      cancelButtonColor: '#999',
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel'
    })

    if (!result.isConfirmed) return

    try {
      const token = getAuthToken()
      const res = await fetch(`/api/admin/discounts/${discount.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete discount')
      }
      toast.success('Discount deleted')
      fetchDiscounts()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete discount')
    }
  }

  const toggleActive = async (discount: Discount) => {
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/admin/discounts/${discount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isActive: !discount.isActive })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update discount')
      }
      toast.success(discount.isActive ? 'Discount deactivated' : 'Discount activated')
      fetchDiscounts()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update discount')
    }
  }

  const formatDiscount = (discount: Discount) => {
    const value = Number(discount.discountValue)
    if (discount.discountType === 'percentage') return `${value}% OFF`
    return `LKR ${value.toLocaleString()} OFF`
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getTarget = (discount: Discount) => {
    if (discount.scope === 'product') return { icon: Package, label: discount.product?.prodName || `Product #${discount.productId}` }
    if (discount.scope === 'category') return { icon: FolderTree, label: discount.category?.name || `Category #${discount.categoryId}` }
    return { icon: Folder, label: discount.subCategory?.name ? `${discount.subCategory.name} (${discount.subCategory.category?.name || ''})` : `Sub Category #${discount.subCategoryId}` }
  }

  const getStatus = (discount: Discount) => {
    if (!discount.isActive) return 'inactive'
    if (discount.validUntil && new Date(discount.validUntil) < new Date()) return 'expired'
    if (discount.validFrom && new Date(discount.validFrom) > new Date()) return 'scheduled'
    return 'active'
  }

  const filteredProducts = products.filter((p: any) =>
    p.prodName.toLowerCase().includes(productQuery.toLowerCase())
  ).slice(0, 30)

  const selectProduct = (product: any) => {
    setForm({ ...form, productId: String(product.id) })
    setProductQuery(product.prodName)
    setProductOpen(false)
  }

  return (
    <div className={styles.layout}>
      <AdminSidebar userEmail={user?.email || ''} />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1>Discounts</h1>
            <p className={styles.subtitle}>Apply flat or percentage discounts to products, categories, or sub categories</p>
          </div>
          <button className={styles.addBtn} onClick={openAdd}>
            <Plus size={16} /> New Discount
          </button>
        </div>

        <div className={styles.tableWrapper}>
          {loading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : discounts.length === 0 ? (
            <div className={styles.empty}>
              <p>No discounts yet</p>
              <span>Create your first discount to start showing sale prices to customers.</span>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Discount</th>
                  <th>Targets</th>
                  <th>Type</th>
                  <th>Valid From</th>
                  <th>Valid Until</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((discount) => {
                  const target = getTarget(discount)
                  const TargetIcon = target.icon
                  return (
                    <tr key={discount.id}>
                      <td>
                        <div className={styles.codeCell}>
                          <strong>{discount.name}</strong>
                          <span className={styles.descCell}>{discount.description}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.targetCell}>
                          <TargetIcon size={15} />
                          <span>{target.label}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.typePill} ${discount.discountType === 'percentage' ? styles.typePct : styles.typeFixed}`}>
                          {formatDiscount(discount)}
                        </span>
                      </td>
                      <td>{formatDate(discount.validFrom)}</td>
                      <td>{formatDate(discount.validUntil)}</td>
                      <td>
                        <span className={`${styles.status} ${styles[getStatus(discount)]}`}>
                          {getStatus(discount)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={`${styles.toggleBtn} ${discount.isActive ? styles.toggleOn : styles.toggleOff}`}
                            onClick={() => toggleActive(discount)}
                            title={discount.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {discount.isActive ? 'Active' : 'Inactive'}
                          </button>
                          <button className={styles.actionBtn} onClick={() => openEdit(discount)} title="Edit">
                            <PenLine size={15} />
                          </button>
                          <button className={styles.actionBtn} onClick={() => handleDelete(discount)} title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {showModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editId ? 'Edit Discount' : 'New Discount'}</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label>Discount Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Summer Sale"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Description</label>
                <input
                  type="text"
                  placeholder="Short description shown on the product page"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Discount Type</label>
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (LKR)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Discount Value *</label>
                  <input
                    type="number"
                    placeholder={form.discountType === 'percentage' ? 'e.g. 20' : 'e.g. 500'}
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Applies To</label>
                <select
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value, productId: '', categoryId: '', subCategoryId: '' })}
                >
                  <option value="product">Individual Product</option>
                  <option value="category">Main Category</option>
                  <option value="subcategory">Sub Category</option>
                </select>
              </div>

              {form.scope === 'product' && (
                <div className={styles.formGroup}>
                  <label>Product *</label>
                  <div className={styles.productSelect}>
                    <div className={styles.productInputWrap}>
                      <Search size={15} className={styles.productSearchIcon} />
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={productQuery}
                        onChange={(e) => { setProductQuery(e.target.value); setProductOpen(true) }}
                        onFocus={() => setProductOpen(true)}
                        onBlur={() => setTimeout(() => setProductOpen(false), 200)}
                      />
                    </div>
                    {productOpen && (
                      <div className={styles.productList}>
                        {filteredProducts.length === 0 ? (
                          <div className={styles.productListEmpty}>No products found</div>
                        ) : (
                          filteredProducts.map((p) => (
                            <div
                              key={p.id}
                              className={`${styles.productOption} ${form.productId === String(p.id) ? styles.productOptionActive : ''}`}
                              onMouseDown={() => selectProduct(p)}
                            >
                              <span>{p.prodName}</span>
                              <span className={styles.productPrice}>LKR {Number(p.prodPrice).toLocaleString()}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {form.scope === 'category' && (
                <div className={styles.formGroup}>
                  <label>Category *</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.scope === 'subcategory' && (
                <div className={styles.formGroup}>
                  <label>Sub Category *</label>
                  <select
                    value={form.subCategoryId}
                    onChange={(e) => setForm({ ...form, subCategoryId: e.target.value })}
                  >
                    <option value="">Select a sub category</option>
                    {subcategories.map((sub) => (
                      <option key={sub.id} value={String(sub.id)}>
                        {sub.name} ({sub.category?.name || ''})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Valid From</label>
                  <input
                    type="datetime-local"
                    value={form.validFrom}
                    onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Valid Until</label>
                  <input
                    type="datetime-local"
                    value={form.validUntil}
                    onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Active</label>
                <select
                  value={form.isActive ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Discount'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  )
}
