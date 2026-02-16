'use client'
import styles from './women.module.css'

export default function Women() {
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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>369</div>
        <nav className={styles.nav}>
          <a href="/shop" className={styles.navLink}>Home</a>
          <a href="/women" className={`${styles.navLink} ${styles.active}`}>Women</a>
          <a href="/men" className={styles.navLink}>Men</a>
        </nav>
        <div className={styles.icons}>
          <span className={styles.icon}>🔍</span>
          <span className={styles.icon}>🛒</span>
          <span className={styles.icon}>👤</span>
        </div>
      </header>

      <div className={styles.content}>
        <h1 className={styles.title}>Women</h1>

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
            <div key={index} className={styles.product} onClick={() => window.location.href = '/product'}>
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
    </div>
  )
}
