'use client'
import styles from './shop.module.css'
import { useState } from 'react'

export default function Shop() {
  const [isCartOpen, setIsCartOpen] = useState(false)

  const products = [
    { name: 'Sculpted Wool Jacket', price: '$495' },
    { name: 'Essential Silk Blouse', price: '$285' },
    { name: 'Cashmere Crewneck', price: '$395' },
    { name: 'Tailored Trousers', price: '$325' },
    { name: 'Structured Leather Bag', price: '$645' },
    { name: 'Merino Knit Dress', price: '$425' },
    { name: 'Leather Loafers', price: '$385' },
    { name: 'Camel Overcoat', price: '$895' },
  ]

  const cartItems = [
    { name: 'Sculpted Wool Blazer', color: 'Black', size: 'M', price: 485, quantity: 1 },
    { name: 'Essential Cotton Shirt', color: 'White', size: 'L', price: 195, quantity: 2 },
    { name: 'Cashmere Crewneck', color: 'Gray', size: 'M', price: 320, quantity: 1 },
  ]

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shipping = 25
  const total = subtotal + shipping

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>369</div>
        <nav className={styles.nav}>
          <a href="/shop" className={`${styles.navLink} ${styles.active}`}>Home</a>
          <a href="/women" className={styles.navLink}>Women</a>
          <a href="/men" className={styles.navLink}>Men</a>
        </nav>
        <div className={styles.icons}>
          <span className={styles.icon}>🔍</span>
          <span className={styles.icon} onClick={() => setIsCartOpen(true)} style={{ cursor: 'pointer' }}>🛒</span>
          <span className={styles.icon}>👤</span>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1>Refined Essentials for Every Day</h1>
          <p>Discover timeless pieces crafted with intention, designed to elevate the everyday with quiet sophistication.</p>
        </div>
        <div className={styles.heroImage}>
          <img src="https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png" alt="Fashion" />
        </div>
      </section>

      <div className={styles.tabs}>
        <div className={`${styles.tab} ${styles.active}`}>Personalized Gallery</div>
        <div className={styles.tab}>New</div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>New Arrivals</h2>
        <div className={styles.products}>
          {products.map((product, index) => (
            <div key={index} className={styles.product} onClick={() => window.location.href = '/product'}>
              <div className={styles.productImage}>
                <img src="https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png" alt={product.name} />
              </div>
              <div className={styles.productName}>{product.name}</div>
              <div className={styles.productPrice}>{product.price}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerSection}>
          <h3>369</h3>
          <p>Refined essentials for the modern wardrobe.</p>
        </div>
        <div className={styles.footerSection}>
          <h3>Shop</h3>
          <div className={styles.footerLinks}>
            <a href="#" className={styles.footerLink}>Women</a>
            <a href="#" className={styles.footerLink}>Men</a>
            <a href="#" className={styles.footerLink}>New Arrivals</a>
          </div>
        </div>
        <div className={styles.footerSection}>
          <h3>Help</h3>
          <div className={styles.footerLinks}>
            <a href="#" className={styles.footerLink}>Contact</a>
            <a href="#" className={styles.footerLink}>Shipping</a>
            <a href="#" className={styles.footerLink}>Returns</a>
          </div>
        </div>
        <div className={styles.footerSection}>
          <h3>About</h3>
          <div className={styles.footerLinks}>
            <a href="#" className={styles.footerLink}>Our Story</a>
            <a href="#" className={styles.footerLink}>Sustainability</a>
            <a href="#" className={styles.footerLink}>Careers</a>
          </div>
        </div>
      </footer>

      {isCartOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsCartOpen(false)}></div>
          <div className={styles.cart}>
            <div className={styles.cartHeader}>
              <div>
                <h2 className={styles.cartTitle}>Shopping Bag</h2>
                <p className={styles.itemCount}>{cartItems.length} items</p>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsCartOpen(false)}>✕</button>
            </div>
            <div className={styles.cartItems}>
              {cartItems.map((item, index) => (
                <div key={index} className={styles.cartItem}>
                  <div className={styles.cartItemImage}>
                    <img src="https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png" alt={item.name} />
                  </div>
                  <div className={styles.cartItemDetails}>
                    <h3 className={styles.cartItemName}>{item.name}</h3>
                    <p className={styles.cartItemVariant}>{item.color} / Size {item.size}</p>
                    <p className={styles.cartItemPrice}>${item.price}</p>
                    <div className={styles.cartItemActions}>
                      <div className={styles.quantity}>
                        <button className={styles.qtyBtn}>−</button>
                        <span>{item.quantity}</span>
                        <button className={styles.qtyBtn}>+</button>
                      </div>
                      <button className={styles.removeBtn}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.cartSummary}>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span>${subtotal.toLocaleString()}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Shipping</span>
                <span>${shipping}</span>
              </div>
              <div className={styles.totalRow}>
                <span>Total</span>
                <span className={styles.totalAmount}>${total.toLocaleString()}</span>
              </div>
              <button className={styles.checkoutBtn}>Proceed to Checkout</button>
              <p className={styles.taxNote}>Taxes calculated at checkout</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
