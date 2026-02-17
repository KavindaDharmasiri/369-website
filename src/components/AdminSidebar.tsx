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
          <span className={styles.icon}>▦</span> Dashboard
        </Link>
        
        <div className={styles.navSection}>
          <div className={styles.navSectionTitle}>Category Management</div>
          <Link href="/admin/category" className={`${styles.navLink} ${styles.subLink} ${pathname.startsWith('/admin/category') ? styles.active : ''}`}>
            <span className={styles.icon}>☰</span> Category
          </Link>
          <Link href="/admin/subcategory" className={`${styles.navLink} ${styles.subLink} ${pathname.startsWith('/admin/subcategory') ? styles.active : ''}`}>
            <span className={styles.icon}>≡</span> Sub Category
          </Link>
        </div>
        
        <div className={styles.navSection}>
          <div className={styles.navSectionTitle}>Product Management</div>
          <Link href="/admin/products" className={`${styles.navLink} ${styles.subLink} ${pathname.startsWith('/admin/products') ? styles.active : ''}`}>
            <span className={styles.icon}>▢</span> Product
          </Link>
          <Link href="/admin/orders" className={`${styles.navLink} ${styles.subLink} ${pathname.startsWith('/admin/orders') ? styles.active : ''}`}>
            <span className={styles.icon}>◈</span> Orders
          </Link>
        </div>
        
        <div className={styles.navSection}>
          <div className={styles.navSectionTitle}>Financial Management</div>
          <Link href="/admin/transactions" className={`${styles.navLink} ${styles.subLink} ${pathname.startsWith('/admin/transactions') ? styles.active : ''}`}>
            <span className={styles.icon}>$</span> Transactions
          </Link>
          <Link href="/admin/analytics" className={`${styles.navLink} ${styles.subLink} ${pathname.startsWith('/admin/analytics') ? styles.active : ''}`}>
            <span className={styles.icon}>◐</span> Analytics
          </Link>
        </div>
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
