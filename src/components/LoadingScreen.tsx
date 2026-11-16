'use client'
import { useEffect, useState } from 'react'
import styles from './LoadingScreen.module.css'

interface LoadingScreenProps {
  isLoading: boolean
}

export default function LoadingScreen({ isLoading }: LoadingScreenProps) {
  const [show, setShow] = useState(isLoading)
  const [previousLoading, setPreviousLoading] = useState(isLoading)

  // Preserve the exit animation, but show immediately when a new load starts.
  // Adjusting this component's state during render avoids an extra effect render.
  if (previousLoading !== isLoading) {
    setPreviousLoading(isLoading)
    if (isLoading) setShow(true)
  }

  useEffect(() => {
    if (!isLoading && show) {
      const timer = setTimeout(() => setShow(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isLoading, show])

  if (!show) return null

  return (
    <div className={`${styles.overlay} ${!isLoading ? styles.fadeOut : ''}`}>
      <div className={styles.container}>
        <div className={styles.logoContainer}>
          <span className={`${styles.letter} ${styles.letter1}`}>3</span>
          <span className={`${styles.letter} ${styles.letter2}`}>6</span>
          <span className={`${styles.letter} ${styles.letter3}`}>9</span>
        </div>
        <div className={styles.spinner}></div>
        <p className={styles.text}>Loading...</p>
      </div>
    </div>
  )
}
