'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './AdminSidebar.module.css'

interface AdminSidebarProps {
  userEmail: string
}

export default function AdminSidebar({ userEmail }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>369</div>
      <nav className={styles.nav}>
        <Link href="/admin" className={`${styles.navLink} ${pathname === '/admin' ? styles.active : ''}`}>
          <span className={styles.icon}>📊</span> Dashboard
        </Link>
        <Link href="/admin/category" className={`${styles.navLink} ${pathname.startsWith('/admin/category') ? styles.active : ''}`}>
          <span className={styles.icon}>📂</span> Category
        </Link>
        <Link href="/admin/products" className={`${styles.navLink} ${pathname.startsWith('/admin/products') ? styles.active : ''}`}>
          <span className={styles.icon}>📦</span> Products
        </Link>
        <Link href="/admin/orders" className={`${styles.navLink} ${pathname.startsWith('/admin/orders') ? styles.active : ''}`}>
          <span className={styles.icon}>🛒</span> Orders
        </Link>
        <Link href="/admin/analytics" className={`${styles.navLink} ${pathname.startsWith('/admin/analytics') ? styles.active : ''}`}>
          <span className={styles.icon}>📈</span> Analytics
        </Link>
      </nav>
      
      <div className={styles.userProfile}>
        <div className={styles.avatar}>A</div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>Admin</div>
          <div className={styles.userEmail}>{userEmail}</div>
        </div>
        <button className={styles.menuBtn}>⋮</button>
      </div>
    </aside>
  )
}
