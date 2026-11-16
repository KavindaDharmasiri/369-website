'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { removeAuthToken } from '@/lib/clientAuth'
import { useClientAuthUser } from '@/lib/useClientAuthUser'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'
import Cart from '@/components/Cart'
import { PageSkeleton } from '@/components/Skeleton'
import Swal from 'sweetalert2'
import styles from './account.module.css'

export default function AccountClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useClientAuthUser()
  const activeTab = pathname?.includes('/profile') ? 'profile'
    : pathname?.includes('/addresses') ? 'addresses'
    : pathname?.includes('/wishlist') ? 'wishlist' : 'orders'
  const [showCart, setShowCart] = useState(false)

  useEffect(() => {
    if (user === undefined) return
    if (!user) {
      router.push('/signin')
      return
    }
  }, [router, user])

  const handleSignOut = async () => {
    const result = await Swal.fire({
      title: 'Sign Out?',
      text: 'Are you sure you want to sign out?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#000',
      cancelButtonColor: '#666',
      confirmButtonText: 'Yes, sign out',
      cancelButtonText: 'Cancel'
    })

    if (result.isConfirmed) {
      removeAuthToken()
      router.push('/')
    }
  }

  if (!user) return <PageSkeleton variant="table" />

  return (
    <div className={styles.pageWrapper}>
      <CustomerHeader user={user} onCartOpen={() => setShowCart(true)} />
      <Cart isOpen={showCart} onClose={() => setShowCart(false)} />
      <div className={styles.container}>
        <div className={styles.sidebar}>
          <h2>My Account</h2>
          <nav className={styles.nav}>
            <button
              className={activeTab === 'profile' ? styles.active : ''}
              onClick={() => router.push('/customer/account/profile')}
            >
              Profile
            </button>
            <button
              className={activeTab === 'orders' ? styles.active : ''}
              onClick={() => router.push('/customer/account/orders')}
            >
              Orders
            </button>
            <button
              className={activeTab === 'addresses' ? styles.active : ''}
              onClick={() => router.push('/customer/account/addresses')}
            >
              Addresses
            </button>
            <button
              className={activeTab === 'wishlist' ? styles.active : ''}
              onClick={() => router.push('/customer/account/wishlist')}
            >
              Wishlist
            </button>
            <button onClick={handleSignOut}>Sign Out</button>
          </nav>
        </div>
        <div className={styles.content} key={user.userId}>{children}</div>
      </div>
      <CustomerFooter />
    </div>
  )
}
