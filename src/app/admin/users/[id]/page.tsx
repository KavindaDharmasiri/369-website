'use client'
import styles from '../../adminShared.module.css'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getAuthUser, removeAuthToken, getAuthToken } from '@/lib/clientAuth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import { Skeleton } from '@/components/Skeleton'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#fff3cd', color: '#664d03' },
  PAID: { bg: '#d1e7dd', color: '#0f5132' },
  SHIPPED: { bg: '#cfe2ff', color: '#084298' },
  DELIVERED: { bg: '#d1e7dd', color: '#0f5132' },
  CANCELLED: { bg: '#f8d7da', color: '#842029' },
  REFUNDED: { bg: '#e2e3e5', color: '#41464b' },
}

export default function AdminUserDetail() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    if (!id) return

    fetch(`/api/admin/users/${id}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to fetch profile')
        setProfile(json.data?.profile)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [router, id])

  if (!user) return null

  const initials = (profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '')

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Customer Profile</h1>
            <div className={styles.breadcrumb}>
              <Link href="/admin">Dashboard</Link>
              <span> / </span>
              <Link href="/admin/users">Users</Link>
              <span> / </span>
              <span className={styles.breadcrumbActive}>{profile?.email || 'Profile'}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height="120px" />
            <Skeleton height="200px" />
          </div>
        ) : error ? (
          <p className={styles.errorText}>{error}</p>
        ) : profile ? (
          <>
            <div className={styles.tableSection} style={{ marginBottom: 24 }}>
              <div className={styles.tableHeader}>
                <h3>Account Details</h3>
                <span
                  className={styles.statusBadge}
                  style={profile.userType === 'admin' ? { background: '#e2e3e5', color: '#41464b' } : { background: '#cfe2ff', color: '#084298' }}
                >
                  {profile.userType}
                </span>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #111827, #374151)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      fontWeight: 600,
                    }}
                  >
                    {initials || (profile.email?.[0] || '').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{profile.firstName} {profile.lastName}</div>
                    <div style={{ fontSize: 13, color: '#6c757d' }}>{profile.email}</div>
                  </div>
                </div>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <label>Phone</label>
                    <p>{profile.phone || '—'}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Date of Birth</label>
                    <p>{profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : '—'}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Total Orders</label>
                    <p>{profile.orderCount}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Total Spent</label>
                    <p>LKR {Number(profile.totalSpent || 0).toLocaleString()}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Joined</label>
                    <p>{new Date(profile.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {profile.addresses && profile.addresses.length > 0 && (
              <div className={styles.tableSection} style={{ marginBottom: 24 }}>
                <div className={styles.tableHeader}>
                  <h3>Addresses</h3>
                </div>
                <div style={{ padding: 24 }}>
                  {profile.addresses.map((addr: any) => (
                    <div key={addr.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f3f5' }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>
                        {addr.addressLine1}{addr.city ? `, ${addr.city}` : ''}
                      </div>
                      <div style={{ fontSize: 13, color: '#6c757d' }}>
                        {addr.phone}{addr.isDefault ? ' · Default' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.tableSection} style={{ marginBottom: 24 }}>
              <div className={styles.tableHeader}>
                <h3>Recent Orders</h3>
              </div>
              {profile.orders?.length ? (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.orders.map((o: any) => {
                      const badge = STATUS_COLORS[o.status] || STATUS_COLORS.PENDING
                      return (
                        <tr key={o.id}>
                          <td>{o.orderNumber}</td>
                          <td>{new Date(o.createdAt).toLocaleString()}</td>
                          <td>{o.orderItems?.length || 0}</td>
                          <td>LKR {Number(o.total || 0).toLocaleString()}</td>
                          <td>
                            <span className={styles.statusBadge} style={{ background: badge.bg, color: badge.color }}>
                              {o.status}
                            </span>
                          </td>
                          <td>
                            <Link href={`/admin/orders/${o.id}`} style={{ color: '#0d6efd', fontSize: 14 }}>
                              View
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className={styles.emptyState}>No orders yet.</div>
              )}
            </div>

            <div className={styles.tableSection}>
              <div className={styles.tableHeader}>
                <h3>Recent Activity</h3>
              </div>
              {profile.auditTrail?.length ? (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Details</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.auditTrail.map((a: any) => (
                      <tr key={a.id}>
                        <td>
                          <span className={styles.statusBadge} style={{ background: '#e2e3e5', color: '#41464b' }}>
                            {a.action}
                          </span>
                        </td>
                        <td>{a.entityType} · {a.entityId}</td>
                        <td style={{ fontSize: 13, color: '#6c757d' }}>{a.details || '—'}</td>
                        <td>{new Date(a.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className={styles.emptyState}>No recorded activity.</div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
