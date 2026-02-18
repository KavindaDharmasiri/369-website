'use client'
import styles from './signin.module.css'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { encryptData, decryptData } from '@/lib/clientEncryption'
import { setAuthToken } from '@/lib/auth'

export default function SignIn() {
  const router = useRouter()
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

      setAuthToken(data.token)
      toast.success('Login successful!')
      
      // Redirect based on user type
      if (data.user.userType === 'admin') {
        setTimeout(() => router.push('/admin'), 1000)
      } else {
        setTimeout(() => router.push('/customer/shop'), 1000)
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className={styles.container}>
      <Toaster position="top-center" />
      <header className={styles.logo} onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>369</header>
      
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
          <a href="#" className={styles.link}>Forgot password?</a>
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
