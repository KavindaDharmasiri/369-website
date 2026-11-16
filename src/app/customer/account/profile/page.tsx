'use client'
import { useState, useEffect } from 'react'
import { getAuthToken } from '@/lib/clientAuth'
import { useClientAuthUser } from '@/lib/useClientAuthUser'
import { decryptData } from '@/lib/clientEncryption'
import toast from 'react-hot-toast'
import styles from './profile.module.css'
import { Skeleton } from '@/components/Skeleton'

export default function ProfilePage() {
  const user = useClientAuthUser()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefLoading, setPrefLoading] = useState(true)
  const [prefSaving, setPrefSaving] = useState(false)
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true)
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', dateOfBirth: '' })

  useEffect(() => {
    if (user) {
      fetchProfile()
      fetchPreference()
    }
  }, [user])

  async function fetchProfile() {
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

  async function fetchPreference() {
    try {
      const res = await fetch('/api/personalization/preferences', { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.data) setPersonalizationEnabled(json.data.personalizationEnabled !== false)
    } catch {
      // keep default
    } finally {
      setPrefLoading(false)
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

  const togglePersonalization = async () => {
    const next = !personalizationEnabled
    setPrefSaving(true)
    try {
      const res = await fetch('/api/personalization/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ personalizationEnabled: next }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'Failed to update preference')
      setPersonalizationEnabled(next)
      toast.success(next ? 'Personalized suggestions enabled' : 'Personalized suggestions turned off')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update preference')
    } finally {
      setPrefSaving(false)
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
            <h3 className={styles.cardTitle}>Shopping preferences</h3>
            <p className={styles.prefDescription}>
              Personalized suggestions use your browsing and shopping activity to help you discover relevant products. You can turn this off at any time.
            </p>
            <div className={styles.prefRow}>
              <div>
                <div className={styles.prefLabel}>Personalized recommendations</div>
                <div className={styles.prefStatus}>
                  {prefLoading ? 'Loading preference…' : personalizationEnabled ? 'Enabled for this account' : 'Disabled for this account'}
                </div>
              </div>
              <button
                type="button"
                className={`${styles.prefBtn} ${personalizationEnabled ? styles.prefBtnEnabled : ''}`}
                onClick={togglePersonalization}
                disabled={prefLoading || prefSaving}
                aria-pressed={personalizationEnabled}
              >
                {prefSaving ? 'Saving…' : prefLoading ? 'Loading…' : personalizationEnabled ? 'Turn off' : 'Turn on'}
              </button>
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
