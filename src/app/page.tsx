'use client'
import styles from './page.module.css'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const heroImage = 'https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png'

  const handleClick = () => {
    router.push('/signin')
  }

  return (
    <main className={styles.container} onClick={handleClick}>
      <header className={styles.logo}>369</header>
      
      <div className={styles.heroImage}>
        <img src={heroImage} alt="Fashion model" />
      </div>
      
      <h1 className={styles.title}>Everyday Quiet Luxury</h1>
      
      <div className={styles.buttons}>
        <button className={styles.btn}>Shop Women</button>
        <button className={styles.btn}>Shop Men</button>
      </div>
      
      <a href="#" className={styles.link}>Browse New Arrivals</a>
    </main>
  )
}
