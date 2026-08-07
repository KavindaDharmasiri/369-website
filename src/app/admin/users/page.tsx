'use client'
import styles from '../adminShared.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser, removeAuthToken, getAuthToken } from '@/lib/clientAuth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import { TableSkeleton } from '@/components/Skeleton'

export default function AdminUsers() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
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
    fetchUsers('')
  }, [router])

  const fetchUsers = (q: string) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ limit: '100' })
    if (q) params.set('search', q)
    fetch(`/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to fetch users')
        setUsers(json.data?.users || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers(search)
  }

  if (!user) return null

  const totalCustomers = users.filter((u) => u.userType === 'customer').length
  const totalAdmins = users.filter((u) => u.userType === 'admin').length
  const totalSpent = users.reduce((sum, u) => sum + Number(u.totalSpent || 0), 0)

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>User Management</h1>
            <div className={styles.breadcrumb}>
              <Link href="/admin">Dashboard</Link>
              <span> / </span>
              <span className={styles.breadcrumbActive}>Users</span>
            </div>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Users</div>
            <div className={styles.statValue}>{users.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Customers</div>
            <div className={styles.statValue}>{totalCustomers}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Admins</div>
            <div className={styles.statValue}>{totalAdmins}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Lifetime Spend</div>
            <div className={styles.statValue}>LKR {totalSpent.toLocaleString()}</div>
          </div>
        </div>

        <div className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <h3>All Users</h3>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
              <input
                className={styles.searchInput}
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className={styles.primaryBtn}>
                Search
              </button>
            </form>
          </div>

          {loading ? (
            <div style={{ padding: 16 }}>
              <TableSkeleton rows={8} cols={6} />
            </div>
          ) : error ? (
            <p className={styles.errorText}>{error}</p>
          ) : users.length === 0 ? (
            <div className={styles.emptyState}>No users found.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Phone</th>
                  <th>Orders</th>
                  <th>Total Spent</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.firstName || ''} {u.lastName || ''}</strong>
                      <div style={{ fontSize: 12, color: '#6c757d' }}>{u.email}</div>
                    </td>
                    <td>
                      <span
                        className={styles.statusBadge}
                        style={u.userType === 'admin' ? { background: '#e2e3e5', color: '#41464b' } : { background: '#cfe2ff', color: '#084298' }}
                      >
                        {u.userType}
                      </span>
                    </td>
                    <td>{u.phone || '—'}</td>
                    <td>{u._count?.orders ?? 0}</td>
                    <td>LKR {Number(u.totalSpent || 0).toLocaleString()}</td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <Link href={`/admin/users/${u.id}`} style={{ color: '#0d6efd', fontSize: 14 }}>
                        View Profile
                      </Link>
                    </td>
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
