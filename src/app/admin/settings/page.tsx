'use client'
import styles from '../adminShared.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, removeAuthToken, getAuthToken } from '@/lib/clientAuth'
import { decryptData } from '@/lib/clientEncryption'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import { Skeleton } from '@/components/Skeleton'
import toast from 'react-hot-toast'

export default function AdminSettings() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({ taxMode: 'percentage', taxRate: '8', lowStockThreshold: '10' })

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
    fetchSettings()
  }, [router])

  const fetchSettings = () => {
    setLoading(true)
    fetch('/api/settings')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load settings')
        const data = decryptData(json.data)
        setSettings({
          taxMode: data.taxMode || 'percentage',
          taxRate: String(data.taxRate ?? '8'),
          lowStockThreshold: String(data.lowStockThreshold ?? '10'),
        })
      })
      .catch(() => {
        setSettings({ taxMode: 'percentage', taxRate: '8', lowStockThreshold: '10' })
      })
      .finally(() => setLoading(false))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify(settings),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save settings')
      toast.success('Settings saved')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Settings</h1>
            <div className={styles.breadcrumb}>
              <Link href="/admin">Dashboard</Link>
              <span> / </span>
              <span className={styles.breadcrumbActive}>Settings</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
            <Skeleton height="80px" />
            <Skeleton height="80px" />
          </div>
        ) : (
          <div className={styles.tableSection} style={{ maxWidth: 560 }}>
            <div className={styles.tableHeader}>
              <h3>Store Settings</h3>
            </div>
            <form onSubmit={handleSave} style={{ padding: 24 }}>
              <div className={styles.formGroup}>
                <label>Tax Mode</label>
                <select
                  value={settings.taxMode}
                  onChange={(e) => setSettings({ ...settings, taxMode: e.target.value })}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (LKR)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>{settings.taxMode === 'percentage' ? 'Tax Rate (%)' : 'Tax Amount (LKR)'}</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={settings.taxRate}
                  onChange={(e) => setSettings({ ...settings, taxRate: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Low Stock Threshold</label>
                <input
                  type="number"
                  min="0"
                  value={settings.lowStockThreshold}
                  onChange={(e) => setSettings({ ...settings, lowStockThreshold: e.target.value })}
                />
                <div style={{ fontSize: 12, color: '#6c757d', marginTop: 6 }}>
                  Products with stock at or below this level will trigger low-stock alerts.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="submit" className={styles.primaryBtn} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
