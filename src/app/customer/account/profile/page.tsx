'use client'
import { useState, useEffect } from 'react'
import { getAuthUser, getAuthToken } from '@/lib/clientAuth'
import { decryptData } from '@/lib/clientEncryption'
import toast from 'react-hot-toast'
import styles from './profile.module.css'
import { Skeleton } from '@/components/Skeleton'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', dateOfBirth: '' })

  useEffect(() => {
    const authUser = getAuthUser()
    setUser(authUser)
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      if (!res.ok) throw new Error('Failed to load profile')
      const json = await res.json()
      const decrypted = decryptData(json.data)
      const p = decrypted.profile
      setProfile(p)
      setForm({
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        phone: p.phone || '',
        dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '',
      })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Update failed')
      toast.success('Profile updated')
      fetchProfile()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  const initials = ((profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '') || (user.email?.[0] || '')).toUpperCase()

  return (
    <div style={{ padding: '20px 0' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '8px', color: '#2c3e50' }}>Profile</h1>
      <p style={{ color: '#5a6c7d', marginBottom: '30px' }}>Your account information</p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton height="100px" />
          <Skeleton height="240px" />
        </div>
      ) : (
        <>
          <div className={styles.headerCard}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.headerInfo}>
              <div className={styles.headerName}>
                {profile?.firstName || profile?.lastName ? `${profile.firstName} ${profile.lastName}` : user.email}
              </div>
              <div className={styles.headerEmail}>{user.email}</div>
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{profile?.orderCount ?? 0}</div>
              <div className={styles.statLabel}>Total Orders</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>LKR {Number(profile?.totalSpent || 0).toLocaleString()}</div>
              <div className={styles.statLabel}>Total Spent</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{profile?.addresses?.length ?? 0}</div>
              <div className={styles.statLabel}>Saved Addresses</div>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Personal Information</h3>
            <form onSubmit={handleSave}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>First Name</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Last Name</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+94 7X XXX XXXX"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Email (read-only)</label>
                  <input value={user.email} disabled />
                </div>
                <div className={styles.formGroup}>
                  <label>Member Since</label>
                  <input value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'} disabled />
                </div>
              </div>
              <button type="submit" className={styles.saveBtn} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
