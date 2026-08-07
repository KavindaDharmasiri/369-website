'use client'
import styles from './coupons.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, getAuthToken } from '@/lib/clientAuth'
import AdminSidebar from '@/components/AdminSidebar'
import toast, { Toaster } from 'react-hot-toast'
import Swal from 'sweetalert2'
import { X, PenLine, Plus, Trash2 } from 'lucide-react'
import { TableSkeleton } from '@/components/Skeleton'

interface Coupon {
  id: number
  code: string
  description: string | null
  discountType: string
  discountValue: string
  minSubtotal: string | null
  maxDiscount: string | null
  validFrom: string | null
  validUntil: string | null
  isActive: boolean
  maxUses: number | null
  usedCount: number
  createdAt: string
}

const emptyForm = {
  code: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  minSubtotal: '',
  maxDiscount: '',
  validFrom: '',
  validUntil: '',
  maxUses: '',
  isActive: true
}

export default function CouponsManagement() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser || authUser.userType !== 'admin') {
      router.push('/signin')
      return
    }
    setUser(authUser)
    fetchCoupons()
  }, [router])

  const fetchCoupons = async () => {
    setLoading(true)
    try {
      const token = getAuthToken()
      const res = await fetch('/api/admin/coupons', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      if (result.success) {
        setCoupons(result.data.coupons || [])
      }
    } catch (error) {
      toast.error('Failed to load coupons')
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => {
    setEditId(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  const openEdit = (coupon: Coupon) => {
    setEditId(coupon.id)
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      minSubtotal: coupon.minSubtotal ? String(coupon.minSubtotal) : '',
      maxDiscount: coupon.maxDiscount ? String(coupon.maxDiscount) : '',
      validFrom: coupon.validFrom ? coupon.validFrom.slice(0, 16) : '',
      validUntil: coupon.validUntil ? coupon.validUntil.slice(0, 16) : '',
      maxUses: coupon.maxUses !== null && coupon.maxUses !== undefined ? String(coupon.maxUses) : '',
      isActive: coupon.isActive
    })
    setShowModal(true)
  }

  const validateForm = () => {
    if (!form.code.trim()) return 'Coupon code is required'
    if (!form.discountValue || Number(form.discountValue) <= 0) return 'Discount value must be greater than 0'
    if (form.discountType === 'percentage' && Number(form.discountValue) > 100) return 'Percentage discount cannot exceed 100%'
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
        code: form.code.trim().toUpperCase(),
        discountValue: Number(form.discountValue)
      }

      const res = editId
        ? await fetch(`/api/admin/coupons/${editId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
          })
        : await fetch('/api/admin/coupons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
          })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'Failed to save coupon')
      }

      toast.success(editId ? 'Coupon updated' : 'Coupon created')
      setShowModal(false)
      fetchCoupons()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save coupon')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (coupon: Coupon) => {
    const result = await Swal.fire({
      title: 'Delete Coupon?',
      text: `Delete coupon "${coupon.code}"? This cannot be undone.`,
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
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete coupon')
      }
      toast.success('Coupon deleted')
      fetchCoupons()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete coupon')
    }
  }

  const toggleActive = async (coupon: Coupon) => {
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isActive: !coupon.isActive })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update coupon')
      }
      toast.success(coupon.isActive ? 'Coupon deactivated' : 'Coupon activated')
      fetchCoupons()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update coupon')
    }
  }

  const formatDiscount = (coupon: Coupon) => {
    const value = Number(coupon.discountValue)
    if (coupon.discountType === 'percentage') return `${value}%`
    return `LKR ${value.toLocaleString()}`
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatus = (coupon: Coupon) => {
    if (!coupon.isActive) return 'inactive'
    if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) return 'expired'
    if (coupon.validFrom && new Date(coupon.validFrom) > new Date()) return 'scheduled'
    return 'active'
  }

  return (
    <div className={styles.layout}>
      <AdminSidebar userEmail={user?.email || ''} />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1>Promotions</h1>
          <button className={styles.addBtn} onClick={openAdd}>
            <Plus size={16} /> New Coupon
          </button>
        </div>

        <div className={styles.tableWrapper}>
          {loading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : coupons.length === 0 ? (
            <div className={styles.empty}>
              <p>No coupons yet</p>
              <span>Create your first promotional coupon to start offering discounts.</span>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min. Subtotal</th>
                  <th>Valid From</th>
                  <th>Valid Until</th>
                  <th>Uses</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td>
                      <div className={styles.codeCell}>
                        <strong>{coupon.code}</strong>
                        {coupon.description && <span className={styles.descCell}>{coupon.description}</span>}
                      </div>
                    </td>
                    <td>{formatDiscount(coupon)}</td>
                    <td>{coupon.minSubtotal ? `LKR ${Number(coupon.minSubtotal).toLocaleString()}` : '—'}</td>
                    <td>{formatDate(coupon.validFrom)}</td>
                    <td>{formatDate(coupon.validUntil)}</td>
                    <td>{coupon.maxUses ? `${coupon.usedCount} / ${coupon.maxUses}` : `${coupon.usedCount}`}</td>
                    <td>
                      <span className={`${styles.status} ${styles[getStatus(coupon)]}`}>
                        {getStatus(coupon)}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={`${styles.toggleBtn} ${coupon.isActive ? styles.toggleOn : styles.toggleOff}`}
                          onClick={() => toggleActive(coupon)}
                          title={coupon.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </button>
                        <button className={styles.actionBtn} onClick={() => openEdit(coupon)} title="Edit">
                          <PenLine size={15} />
                        </button>
                        <button className={styles.actionBtn} onClick={() => handleDelete(coupon)} title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {showModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editId ? 'Edit Coupon' : 'New Coupon'}</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label>Coupon Code *</label>
                <input
                  type="text"
                  placeholder="e.g. WELCOME10"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Description</label>
                <input
                  type="text"
                  placeholder="Short description for admin reference"
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
                    placeholder={form.discountType === 'percentage' ? 'e.g. 10' : 'e.g. 500'}
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Minimum Subtotal (optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={form.minSubtotal}
                    onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Max Discount (optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 1000"
                    value={form.maxDiscount}
                    onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

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

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Max Uses (optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={form.maxUses}
                    onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                    min="0"
                  />
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
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  )
}
