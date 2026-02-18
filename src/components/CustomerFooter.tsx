'use client'
import styles from './CustomerFooter.module.css'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { decryptData } from '@/lib/clientEncryption'

export default function CustomerFooter() {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const result = await res.json()
      const decrypted = decryptData(result.data)
      const activeCategories = (decrypted.categories || []).filter((cat: any) => cat.isActive === true)
      setCategories(activeCategories)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.footerSection}>
        <h3>369</h3>
        <p>Everyday quiet luxury for the modern wardrobe.</p>
      </div>
      <div className={styles.footerSection}>
        <h3>Shop</h3>
        <div className={styles.footerLinks}>
          <Link href="/customer/shop?tab=new" className={styles.footerLink}>New Arrivals</Link>
          {categories.map((category) => (
            <Link 
              key={category.id} 
              href={`/customer/category?type=${category.name.toLowerCase()}`} 
              className={styles.footerLink}
            >
              {category.name}
            </Link>
          ))}
        </div>
      </div>
      <div className={styles.footerSection}>
        <h3>Help</h3>
        <div className={styles.footerLinks}>
          <a href="#" className={styles.footerLink}>Customer Service</a>
          <a href="#" className={styles.footerLink}>Shipping & Returns</a>
          <a href="#" className={styles.footerLink}>Size Guide</a>
          <a href="#" className={styles.footerLink}>Contact Us</a>
        </div>
      </div>
      <div className={styles.footerSection}>
        <h3>Follow</h3>
        <div className={styles.footerLinks}>
          <a href="#" className={styles.footerLink}>Instagram</a>
          <a href="#" className={styles.footerLink}>Pinterest</a>
          <a href="#" className={styles.footerLink}>Journal</a>
        </div>
      </div>
    </footer>
  )
}
