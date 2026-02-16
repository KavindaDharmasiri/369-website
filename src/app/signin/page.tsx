'use client'
import styles from './signin.module.css'
import { useRouter } from 'next/navigation'

export default function SignIn() {
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push('/shop')
  }

  return (
    <main className={styles.container}>
      <header className={styles.logo}>369</header>
      
      <h1 className={styles.title}>Sign In</h1>
      
      <form className={styles.form} onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" className={styles.input} />
        <input type="password" placeholder="Password" className={styles.input} />
        
        <div className={styles.links}>
          <a href="#" className={styles.link}>Forgot password?</a>
          <a href="/signup" className={styles.link}>Create account</a>
        </div>
        
        <button type="submit" className={styles.btn}>Sign In</button>
        
        <a href="#" className={styles.guestLink}>Continue as guest</a>
      </form>
    </main>
  )
}
