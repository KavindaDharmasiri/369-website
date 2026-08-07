'use client'
import styles from '../adminShared.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, removeAuthToken, getAuthToken } from '@/lib/clientAuth'
import { decryptData } from '@/lib/clientEncryption'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import { TableSkeleton } from '@/components/Skeleton'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'

export default function AdminAds() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [banners, setBanners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)

  const emptyForm = { title: '', imageUrl: '', linkUrl: '', position: 'home', isActive: true }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser) {
      router.push('/signin')
      return
    }
    if (authUser.userType !== 'admin') {
      router.push('/customer/shop')
      return
    }
    const currentTime = Math.floor(Date.now() / 1000)
    if (authUser.exp && authUser.exp < currentTime) {
      removeAuthToken()
      router.push('/signin')
      return
    }
    setUser(authUser)
    fetchBanners()
  }, [router])

  const fetchBanners = () => {
    setLoading(true)
    setError('')
    fetch('/api/ads?position=all', { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to fetch banners')
        const decrypted = decryptData(json.data)
        setBanners(decrypted?.banners || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create banner')
      toast.success('Banner created')
      setShowModal(false)
      setForm(emptyForm)
      fetchBanners()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleToggle = async (banner: any) => {
    try {
      const res = await fetch(`/api/ads/${banner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ isActive: !banner.isActive }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Update failed')
      toast.success(banner.isActive ? 'Banner deactivated' : 'Banner activated')
      fetchBanners()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (banner: any) => {
    const result = await Swal.fire({
      title: 'Delete this banner?',
      text: banner.title,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Delete',
    })
    if (!result.isConfirmed) return
    try {
      const res = await fetch(`/api/ads/${banner.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Delete failed')
      toast.success('Banner deleted')
      fetchBanners()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (!user) return null

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Ad Banners</h1>
            <div className={styles.breadcrumb}>
              <Link href="/admin">Dashboard</Link>
              <span> / </span>
              <span className={styles.breadcrumbActive}>Banners</span>
            </div>
          </div>
          <button className={styles.primaryBtn} onClick={() => setShowModal(true)}>
            + New Banner
          </button>
        </div>

        <div className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <h3>Active Campaigns</h3>
          </div>

          {loading ? (
            <div style={{ padding: 16 }}>
              <TableSkeleton rows={4} cols={4} />
            </div>
          ) : error ? (
            <p className={styles.errorText}>{error}</p>
          ) : banners.length === 0 ? (
            <div className={styles.emptyState}>No banners yet. Create your first campaign.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Title</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <img
                        src={b.imageUrl}
                        alt={b.title}
                        style={{ width: 80, height: 48, objectFit: 'cover', borderRadius: 6 }}
                      />
                    </td>
                    <td>
                      <strong>{b.title}</strong>
                      <div style={{ fontSize: 12, color: '#6c757d', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.linkUrl || 'No link'}
                      </div>
                    </td>
                    <td>
                      <span className={styles.statusBadge} style={{ background: '#cfe2ff', color: '#084298' }}>
                        {b.position}
                      </span>
                    </td>
                    <td>
                      <span
                        className={styles.statusBadge}
                        style={b.isActive ? { background: '#d1e7dd', color: '#0f5132' } : { background: '#e2e3e5', color: '#41464b' }}
                      >
                        {b.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className={styles.actionBtn} onClick={() => handleToggle(b)}>
                          {b.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className={styles.actionBtn}
                          style={{ color: '#dc2626' }}
                          onClick={() => handleDelete(b)}
                        >
                          Delete
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
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>New Banner</h2>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label>Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Summer Sale 50% Off"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Image URL</label>
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://..."
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Link URL (optional)</label>
                <input
                  value={form.linkUrl}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Position</label>
                  <select
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                  >
                    <option value="home">Home</option>
                    <option value="shop">Shop</option>
                    <option value="cart">Cart</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select
                    value={form.isActive ? 'true' : 'false'}
                    onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className={styles.actionBtn} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn}>
                  Create Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
