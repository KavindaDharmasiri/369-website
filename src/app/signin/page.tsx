'use client'
import styles from './signin.module.css'
import Link from 'next/link'
import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { encryptData, decryptData } from '@/lib/clientEncryption'
import { setAuthToken } from '@/lib/clientAuth'
import { authDestination } from '@/lib/authNavigation'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const encryptedPayload = encryptData({ email, password })
      
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: encryptedPayload })
      })

      const result = await response.json()
      const data = decryptData(result.data)

      if (!response.ok) {
        toast.error(data.error || 'Login failed')
        setLoading(false)
        return
      }

      if (typeof data.token !== 'string' || data.token.split('.').length !== 3 || !data.user) {
        throw new Error('Sign-in could not be confirmed')
      }
      setAuthToken(data.token)

      // Saved guest items remain on-device for the guarded cart recovery flow.
      // Do not clear them based only on a batch HTTP 200 (items may be skipped).

      toast.success('Login successful!')
      
      // Check for redirect after login
      const redirectTo = sessionStorage.getItem('redirectAfterLogin')
      sessionStorage.removeItem('redirectAfterLogin')
      // A client-set cookie does not invalidate prefetched unauthenticated RSC
      // redirects. A document navigation starts a fresh authenticated router.
      window.location.replace(authDestination(redirectTo, data.user.userType))
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className={styles.container}>
      <Toaster position="top-center" />
      <header className={styles.logo}><Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>369</Link></header>
      
      <h1 className={styles.title}>Sign In</h1>
      
      <form className={styles.form} onSubmit={handleSubmit}>
        <input 
          type="email" 
          placeholder="Email" 
          className={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required 
        />
        
        <div className={styles.links}>
          <a href="/signup" className={styles.link}>Create account</a>
        </div>
        
        <button type="submit" className={styles.btn} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        
        <a href="/customer/shop" className={styles.guestLink}>Continue as guest</a>
      </form>
    </main>
  )
}
