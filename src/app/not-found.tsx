'use client'
import Link from 'next/link'
import styles from './error.module.css'

export default function NotFound() {
  return (
    <div className={styles.container}>
      <h1 className={styles.code}>404</h1>
      <h2 className={styles.title}>Page not found</h2>
      <p className={styles.message}>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
      <div className={styles.actions}>
        <Link href="/" className={styles.primaryBtn}>Back to Home</Link>
      </div>
    </div>
  )
}
