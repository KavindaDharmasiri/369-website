'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LayoutDashboard,
  FolderTree,
  Package,
  ShoppingCart,
  Wallet,
  Users,
  BarChart3,
  Megaphone,
  Settings,
  ScrollText,
  Bell,
  BellOff,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Tag,
  BadgePercent,
} from 'lucide-react'
import styles from './AdminSidebar.module.css'
import { removeAuthToken } from '@/lib/clientAuth'

interface AdminSidebarProps {
  userEmail: string
}

interface NotificationItem {
  id: number
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/notifications?limit=15', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const result = await res.json()
      if (result.success) {
        setNotifications(result.data.notifications || [])
        setUnreadCount(result.data.unreadCount || 0)
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 20000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const markAllRead = async () => {
    try {
      const token = localStorage.getItem('authToken')
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({}),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {
      // silent
    }
  }

  const unreadList = notifications.filter((n) => !n.isRead)

  return (
    <>
      <button className={styles.bellBtn} onClick={() => setOpen(true)} aria-label="Notifications">
        <Bell size={18} />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>
      {open && (
        <>
          <div className={styles.bellBackdrop} onClick={() => setOpen(false)} />
          <div className={styles.bellDrawer}>
            <div className={styles.bellHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={styles.bellTitle}>Notifications</span>
                {unreadCount > 0 && (
                  <span className={styles.bellUnreadChip}>{unreadCount} new</span>
                )}
              </div>
              <button className={styles.bellClose} onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>
            <div className={styles.bellHeaderRow}>
              {unreadCount > 0 && (
                <button className={styles.markReadBtn} onClick={markAllRead}>Mark all read</button>
              )}
            </div>
            <div className={styles.bellList}>
              {notifications.length === 0 ? (
                <div className={styles.bellEmpty}>
                  <div className={styles.bellEmptyIcon}><BellOff size={40} /></div>
                  <p>No notifications yet</p>
                  <span>Order and low-stock alerts will appear here.</span>
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`${styles.bellItem} ${n.isRead ? '' : styles.bellUnread}`}>
                    <div className={styles.bellItemTop}>
                      <div className={styles.bellItemTitle}>
                        <span className={`${styles.bellItemDot} ${n.isRead ? styles.bellItemDotRead : ''}`} />
                        {n.title}
                      </div>
                      <div className={styles.bellItemTime}>{timeAgo(n.createdAt)}</div>
                    </div>
                    <div className={styles.bellItemMsg}>{n.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function NavSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.navSection}>
      <button className={styles.navSectionTitle} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <ChevronDown size={14} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>
      <div className={`${styles.navCollapse} ${open ? styles.navCollapseOpen : ''}`}>
        <div className={styles.navCollapseInner}>{children}</div>
      </div>
    </div>
  )
}

export default function AdminSidebar({ userEmail }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [showLogout, setShowLogout] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowLogout(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleLogout = () => {
    removeAuthToken()
    sessionStorage.clear()
    router.push('/signin')
  }

  const linkCls = (base: string) =>
    `${styles.navLink} ${styles.subLink} ${pathname.startsWith(base) ? styles.active : ''}`

  return (
    <>
      <button className={styles.mobileToggle} onClick={() => setMobileOpen(true)} aria-label="Open menu">
        <Menu size={20} />
      </button>
      {mobileOpen && (
        <div className={styles.mobileBackdrop} onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.mobileCloseRow}>
          <div className={styles.logo}>369</div>
          <button className={styles.mobileClose} onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav className={styles.nav}>
        <Link href="/admin" className={`${styles.navLink} ${pathname === '/admin' ? styles.active : ''}`}>
          <LayoutDashboard size={17} className={styles.icon} /> Dashboard
        </Link>

        <NavSection title="Category Management" defaultOpen={pathname.startsWith('/admin/category')}>
          <Link href="/admin/category" className={linkCls('/admin/category')}>
            <FolderTree size={15} className={styles.icon} /> Category
          </Link>
          <Link href="/admin/subcategory" className={linkCls('/admin/subcategory')}>
            <FolderTree size={15} className={styles.icon} /> Sub Category
          </Link>
        </NavSection>

        <NavSection title="Product Management" defaultOpen={pathname.startsWith('/admin/products') || pathname.startsWith('/admin/orders')}>
          <Link href="/admin/products" className={linkCls('/admin/products')}>
            <Package size={15} className={styles.icon} /> Product
          </Link>
          <Link href="/admin/orders" className={linkCls('/admin/orders')}>
            <ShoppingCart size={15} className={styles.icon} /> Orders
          </Link>
        </NavSection>

        <NavSection title="Financial Management" defaultOpen={pathname.startsWith('/admin/transactions') || pathname.startsWith('/admin/coupons') || pathname.startsWith('/admin/discounts')}>
          <Link href="/admin/transactions" className={linkCls('/admin/transactions')}>
            <Wallet size={15} className={styles.icon} /> Transactions
          </Link>
          <Link href="/admin/coupons" className={linkCls('/admin/coupons')}>
            <Tag size={15} className={styles.icon} /> Promotions
          </Link>
          <Link href="/admin/discounts" className={linkCls('/admin/discounts')}>
            <BadgePercent size={15} className={styles.icon} /> Discounts
          </Link>
        </NavSection>

        <NavSection title="Reporting" defaultOpen={pathname.startsWith('/admin/reports')}>
          <Link href="/admin/reports" className={linkCls('/admin/reports')}>
            <BarChart3 size={15} className={styles.icon} /> Reports
          </Link>
        </NavSection>

        <NavSection title="Management" defaultOpen={pathname.startsWith('/admin/users') || pathname.startsWith('/admin/ads') || pathname.startsWith('/admin/audit')}>
          <Link href="/admin/users" className={linkCls('/admin/users')}>
            <Users size={15} className={styles.icon} /> Users
          </Link>
          <Link href="/admin/ads" className={linkCls('/admin/ads')}>
            <Megaphone size={15} className={styles.icon} /> Ad Banners
          </Link>
          <Link href="/admin/audit" className={linkCls('/admin/audit')}>
            <ScrollText size={15} className={styles.icon} /> Audit Records
          </Link>
          <Link href="/admin/settings" className={linkCls('/admin/settings')}>
            <Settings size={15} className={styles.icon} /> Settings
          </Link>
        </NavSection>
      </nav>

      <div className={styles.userProfile}>
        <div className={styles.avatar}>{(userEmail || 'A').charAt(0).toUpperCase()}</div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{userEmail ? userEmail.split('@')[0] : 'Admin'}</div>
          <div className={styles.userEmail}>{userEmail}</div>
        </div>
        <NotificationBell />
        <div className={styles.menuContainer} ref={menuRef}>
          <button className={styles.menuBtn} onClick={() => setShowLogout(!showLogout)} aria-label="Menu">
            <LogOut size={17} />
          </button>
          {showLogout && (
            <div className={styles.logoutDropdown}>
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
        </div>
      </aside>
    </>
  )
}
