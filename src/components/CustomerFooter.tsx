'use client'
import styles from './CustomerFooter.module.css'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { decryptData } from '@/lib/clientEncryption'
import { Mail, Phone, MapPin, AtSign, Send, Globe } from 'lucide-react'

export default function CustomerFooter() {
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
      <div className={styles.footerGrid}>
        <div className={styles.brandSection}>
          <h3 className={styles.brandLogo}>369</h3>
          <p className={styles.brandTagline}>Everyday quiet luxury for the modern wardrobe.</p>
          <div className={styles.contactList}>
            <div className={styles.contactItem}>
              <Mail size={15} className={styles.contactIcon} />
              <span>hello@369store.com</span>
            </div>
            <div className={styles.contactItem}>
              <Phone size={15} className={styles.contactIcon} />
              <span>+94 11 234 5678</span>
            </div>
            <div className={styles.contactItem}>
              <MapPin size={15} className={styles.contactIcon} />
              <span>Colombo, Sri Lanka</span>
            </div>
          </div>
        </div>

        <div className={styles.footerSection}>
          <h3>Shop</h3>
          <div className={styles.footerLinks}>
            <Link href="/customer/shop" className={styles.footerLink}>Shop All</Link>
            <Link href="/customer/shop?tab=new" className={styles.footerLink}>New Arrivals</Link>
            <Link href="/customer/men" className={styles.footerLink}>Men</Link>
            <Link href="/customer/women" className={styles.footerLink}>Women</Link>
            {categories.slice(0, 4).map((category) => (
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
          <h3>Account</h3>
          <div className={styles.footerLinks}>
            <Link href="/signin" className={styles.footerLink}>Sign In</Link>
            <Link href="/customer/account" className={styles.footerLink}>My Account</Link>
            <Link href="/customer/account/orders" className={styles.footerLink}>My Orders</Link>
            <Link href="/customer/account/wishlist" className={styles.footerLink}>Wishlist</Link>
            <Link href="/customer/cart" className={styles.footerLink}>Cart</Link>
          </div>
        </div>

        <div className={styles.footerSection}>
          <h3>Stay in Touch</h3>
          <p className={styles.newsletterText}>Be the first to know about new arrivals, exclusive drops and private sales.</p>
          <div className={styles.newsletter}>
            <input type="email" placeholder="Your email address" className={styles.newsletterInput} />
            <button className={styles.newsletterBtn}>Subscribe</button>
          </div>
          <div className={styles.socials}>
            <a href="#" aria-label="Instagram" className={styles.socialLink}><AtSign size={18} /></a>
            <a href="#" aria-label="Facebook" className={styles.socialLink}><Send size={18} /></a>
            <a href="#" aria-label="Twitter" className={styles.socialLink}><Globe size={18} /></a>
          </div>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <span>© {new Date().getFullYear()} 369. All rights reserved.</span>
        <span className={styles.credit}>
          Developed &amp; Maintained by <strong>Travler Solutions</strong>
        </span>
      </div>
    </footer>
  )
}
