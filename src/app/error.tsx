'use client'
import styles from './error.module.css'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className={styles.container}>
      <h1 className={styles.code}>500</h1>
      <h2 className={styles.title}>Something went wrong</h2>
      <p className={styles.message}>An unexpected error occurred. Please try again.</p>
      <div className={styles.actions}>
        <button className={styles.primaryBtn} onClick={reset}>Try Again</button>
        <a className={styles.secondaryBtn} href="/">Back to Home</a>
      </div>
    </div>
  )
}
