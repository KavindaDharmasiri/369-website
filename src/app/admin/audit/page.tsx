'use client'
import styles from '../adminShared.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, removeAuthToken, getAuthToken } from '@/lib/clientAuth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import { TableSkeleton } from '@/components/Skeleton'

export default function AdminAudit() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const [action, setAction] = useState('')
  const [search, setSearch] = useState('')
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
    fetchRecords('', '')
  }, [router])

  const fetchRecords = (act: string, q: string) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ limit: '200' })
    if (act) params.set('action', act)
    if (q) params.set('search', q)
    fetch(`/api/audit?${params}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to fetch audit records')
        setRecords(json.data?.records || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    fetchRecords(action, search)
  }

  if (!user) return null

  const actionCounts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.action] = (acc[r.action] || 0) + 1
    return acc
  }, {})

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Audit Trail</h1>
            <div className={styles.breadcrumb}>
              <Link href="/admin">Dashboard</Link>
              <span> / </span>
              <span className={styles.breadcrumbActive}>Audit Log</span>
            </div>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Records Shown</div>
            <div className={styles.statValue}>{records.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Unique Actions</div>
            <div className={styles.statValue}>{Object.keys(actionCounts).length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Most Recent</div>
            <div className={styles.statValue} style={{ fontSize: 16 }}>
              {records[0] ? new Date(records[0].createdAt).toLocaleString() : '—'}
            </div>
          </div>
        </div>

        <div className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <h3>Activity Log</h3>
            <form onSubmit={handleFilter} style={{ display: 'flex', gap: 8 }}>
              <select
                className={styles.searchInput}
                style={{ minWidth: 140 }}
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="">All Actions</option>
                {['LOGIN', 'LOGOUT', 'ORDER_PLACED', 'ORDER_UPDATED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED', 'USER_REGISTERED', 'NEW_USER'].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <input
                className={styles.searchInput}
                placeholder="Search user email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className={styles.primaryBtn}>
                Filter
              </button>
            </form>
          </div>

          {loading ? (
            <div style={{ padding: 16 }}>
              <TableSkeleton rows={10} cols={5} />
            </div>
          ) : error ? (
            <p className={styles.errorText}>{error}</p>
          ) : records.length === 0 ? (
            <div className={styles.emptyState}>No activity recorded yet.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>User</th>
                  <th>Entity</th>
                  <th>Details</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className={styles.statusBadge} style={{ background: '#e2e3e5', color: '#41464b' }}>
                        {r.action}
                      </span>
                    </td>
                    <td>
                      <strong>{r.userEmail}</strong>
                      <div style={{ fontSize: 12, color: '#6c757d' }}>{r.ipAddress}</div>
                    </td>
                    <td>{r.entityType} · {r.entityId || '—'}</td>
                    <td style={{ fontSize: 13, color: '#6c757d', maxWidth: 320 }}>{r.metadata || r.details || '—'}</td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
