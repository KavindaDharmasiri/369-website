'use client'
import styles from './category.module.css'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Category() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isCartOpen, setIsCartOpen] = useState(false)
  const category = searchParams.get('type') || 'women'

  const products = [
    { name: 'Tailored Trousers', price: '$325' },
    { name: 'Camel Overcoat', price: '$895' },
    { name: 'Essential Silk Blouse', price: '$285' },
    { name: 'Cashmere Crewneck', price: '$395' },
    { name: 'Merino Knit Dress', price: '$425' },
    { name: 'Structured Leather Bag', price: '$645' },
    { name: 'Sculpted Wool Jacket', price: '$495' },
    { name: 'Leather Loafers', price: '$385' },
    { name: 'Linen Button-Down', price: '$245' },
    { name: 'Leather Ankle Boots', price: '$485' },
    { name: 'Silk Camisole', price: '$195' },
    { name: 'Structured Blazer', price: '$595' },
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
          <Link href="/customer/shop" className={styles.navLink}>Home</Link>
          <Link href="/customer/category?type=women" className={`${styles.navLink} ${category === 'women' ? styles.active : ''}`}>Women</Link>
          <Link href="/customer/category?type=men" className={`${styles.navLink} ${category === 'men' ? styles.active : ''}`}>Men</Link>
        </nav>
        <div className={styles.icons}>
          <span className={styles.icon}>🔍</span>
          <span className={styles.icon} onClick={() => setIsCartOpen(true)} style={{ cursor: 'pointer' }}>🛒</span>
          <span className={styles.icon}>👤</span>
        </div>
      </header>

      <div className={styles.content}>
        <h1 className={styles.title}>{category === 'men' ? 'Men' : 'Women'}</h1>

        <div className={styles.filterBar}>
          <div className={styles.filters}>
            <button className={styles.filterBtn}>Coats</button>
            <button className={styles.filterBtn}>Knitwear</button>
            <button className={styles.filterBtn}>Trousers</button>
            <button className={styles.filterBtn}>Dresses</button>
            <button className={styles.filterBtn}>Bags</button>
          </div>
          <div className={styles.sort}>
            <span>Sort by</span>
            <select className={styles.sortSelect}>
              <option>Newest</option>
            </select>
          </div>
        </div>

        <div className={styles.products}>
          {products.map((product, index) => (
            <div key={index} className={styles.product} onClick={() => router.push('/customer/product')}>
              <div className={styles.productImage}>
                <img src="https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png" alt={product.name} />
              </div>
              <div className={styles.productName}>{product.name}</div>
              <div className={styles.productPrice}>{product.price}</div>
            </div>
          ))}
        </div>
      </div>

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
