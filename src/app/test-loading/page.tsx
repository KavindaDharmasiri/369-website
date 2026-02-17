'use client'
import { useLoading } from '@/lib/LoadingContext'
import styles from './page.module.css'

export default function TestLoadingPage() {
  const { showLoading, hideLoading } = useLoading()

  const testLoading = (duration: number) => {
    showLoading()
    setTimeout(() => {
      hideLoading()
    }, duration)
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Loading Screen Test</h1>
      <p className={styles.description}>Click any button below to see the loading screen</p>
      
      <div className={styles.buttonGroup}>
        <button 
          className={styles.button}
          onClick={() => testLoading(2000)}
        >
          Show for 2 seconds
        </button>
        
        <button 
          className={styles.button}
          onClick={() => testLoading(5000)}
        >
          Show for 5 seconds
        </button>
        
        <button 
          className={styles.button}
          onClick={() => testLoading(10000)}
        >
          Show for 10 seconds
        </button>
      </div>

      <div className={styles.manualControls}>
        <h2>Manual Controls</h2>
        <div className={styles.buttonGroup}>
          <button 
            className={styles.showBtn}
            onClick={showLoading}
          >
            Show Loading
          </button>
          
          <button 
            className={styles.hideBtn}
            onClick={hideLoading}
          >
            Hide Loading
          </button>
        </div>
      </div>
    </div>
  )
}
