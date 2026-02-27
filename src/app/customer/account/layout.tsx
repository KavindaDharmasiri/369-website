'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'
import Swal from 'sweetalert2'
import styles from './account.module.css'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('orders')
  const [showCart, setShowCart] = useState(false)

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser) {
      router.push('/signin')
      return
    }
    setUser(authUser)
  }, [router])

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
      localStorage.removeItem('authToken')
      document.cookie = 'authToken=; path=/; max-age=0'
      router.push('/')
    }
  }

  if (!user) return <div>Loading...</div>

  return (
    <div className={styles.pageWrapper}>
      <CustomerHeader user={user} onCartOpen={() => setShowCart(true)} />
      <div className={styles.container}>
        <div className={styles.sidebar}>
          <h2>My Account</h2>
          <nav className={styles.nav}>
            <button 
              className={activeTab === 'profile' ? styles.active : ''}
              onClick={() => {
                setActiveTab('profile')
                router.push('/customer/account/profile')
              }}
            >
              Profile
            </button>
            <button 
              className={activeTab === 'orders' ? styles.active : ''}
              onClick={() => {
                setActiveTab('orders')
                router.push('/customer/account/orders')
              }}
            >
              Orders
            </button>
            <button 
              className={activeTab === 'addresses' ? styles.active : ''}
              onClick={() => {
                setActiveTab('addresses')
                router.push('/customer/account/addresses')
              }}
            >
              Addresses
            </button>
            <button onClick={handleSignOut}>Sign Out</button>
          </nav>
        </div>
        <div className={styles.content}>
          {children}
        </div>
      </div>
      <CustomerFooter />
    </div>
  )
}