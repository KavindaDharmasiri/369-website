'use client'
import styles from './Cart.module.css'

interface CartProps {
  isOpen: boolean
  onClose: () => void
}

export default function Cart({ isOpen, onClose }: CartProps) {
  if (!isOpen) return null

  const cartItems = [
    { name: 'Sculpted Wool Blazer', color: 'Black', size: 'M', price: 485, quantity: 1 },
    { name: 'Essential Cotton Shirt', color: 'White', size: 'L', price: 195, quantity: 2 },
    { name: 'Cashmere Crewneck', color: 'Gray', size: 'M', price: 320, quantity: 1 },
  ]

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shipping = 25
  const total = subtotal + shipping

  return (
    <>
      <div className={styles.overlay} onClick={onClose}></div>
      <div className={styles.cart}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Shopping Bag</h2>
            <p className={styles.itemCount}>{cartItems.length} items</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.items}>
          {cartItems.map((item, index) => (
            <div key={index} className={styles.item}>
              <div className={styles.itemImage}>
                <img src="https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png" alt={item.name} />
              </div>
              <div className={styles.itemDetails}>
                <h3 className={styles.itemName}>{item.name}</h3>
                <p className={styles.itemVariant}>{item.color} / Size {item.size}</p>
                <p className={styles.itemPrice}>${item.price}</p>
                <div className={styles.itemActions}>
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

        <div className={styles.summary}>
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
  )
}
