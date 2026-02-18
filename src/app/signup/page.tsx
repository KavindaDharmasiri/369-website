'use client'
import styles from './signup.module.css'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { encryptData, decryptData } from '@/lib/clientEncryption'

export default function SignUp() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState({ email: '', password: '', confirmPassword: '' })

  const validateEmail = (email: string) => {
    if (!email) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format'
    return ''
  }

  const validatePassword = (password: string) => {
    if (!password) return 'Password is required'
    if (password.length < 8) return 'Password must be at least 8 characters'
    return ''
  }

  const validateConfirmPassword = (confirmPassword: string, password: string) => {
    if (!confirmPassword) return 'Please confirm your password'
    if (confirmPassword !== password) return 'Passwords do not match'
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)
    const confirmPasswordError = validateConfirmPassword(confirmPassword, password)

    setErrors({
      email: emailError,
      password: passwordError,
      confirmPassword: confirmPasswordError
    })

    if (emailError || passwordError || confirmPasswordError) {
      toast.error('Please fix the errors in the form')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match!')
      return
    }

    try {
      const encryptedPayload = encryptData({ email, password })
      
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: encryptedPayload })
      })

      const result = await response.json()
      const data = decryptData(result.data)

      if (!response.ok) {
        toast.error(data.error || 'Registration failed')
        return
      }

      toast.success('Account created successfully!')
      setTimeout(() => router.push('/customer/shop'), 1000)
    } catch (error) {
      console.error('Signup error:', error)
      toast.error('Something went wrong. Please try again.')
    }
  }

  return (
    <main className={styles.container}>
      <Toaster position="top-center" />
      <header className={styles.logo} onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>369</header>

      <div className={styles.content}>
        <p className={styles.membership}>Membership</p>
        <h1 className={styles.title}>Create Account</h1>
        <p className={styles.subtitle}>Join our community for exclusive access to<br />new arrivals and personalized galleries.</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Email Address</label>
            <input 
              type="email" 
              placeholder="name@example.com" 
              className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setErrors({ ...errors, email: validateEmail(e.target.value) })
              }}
              required 
            />
            {errors.email && <p className={styles.error}>{errors.email}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input 
              type="password" 
              placeholder="Create a password" 
              className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setErrors({ ...errors, password: validatePassword(e.target.value) })
              }}
              required 
            />
            <p className={styles.hint}>Must be at least 8 characters.</p>
            {errors.password && <p className={styles.error}>{errors.password}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Confirm Password</label>
            <input 
              type="password" 
              placeholder="Repeat password" 
              className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ''}`}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setErrors({ ...errors, confirmPassword: validateConfirmPassword(e.target.value, password) })
              }}
              required 
            />
            {errors.confirmPassword && <p className={styles.error}>{errors.confirmPassword}</p>}
          </div>

          <div className={styles.checkbox}>
            <input 
              type="checkbox" 
              id="terms" 
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required 
            />
            <label htmlFor="terms">
              I agree to the <a href="#" className={styles.link}>Terms of Service</a> and <a href="#" className={styles.link}>Privacy Policy</a>
            </label>
          </div>

          <button type="submit" className={styles.btn} disabled={!agreed}>Create Account</button>

          {/* <p className={styles.divider}>Or continue with</p>

          <div className={styles.socialBtns}>
            <button type="button" className={styles.socialBtn}>
              <span>G</span> Google
            </button>
            <button type="button" className={styles.socialBtn}>
              <span></span> Apple
            </button>
          </div> */}

          <p className={styles.login}>
            Already have an account? <a href="/signin" className={styles.link}>Log In</a>
          </p>
        </form>
      </div>
    </main>
  )
}
