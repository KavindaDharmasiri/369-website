'use client'
import styles from './category.module.css'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAuthUser } from '@/lib/auth'
import { decryptData } from '@/lib/clientEncryption'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'

export const dynamic = 'force-dynamic'

export default function Category() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [subCategories, setSubCategories] = useState<any[]>([])
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('newest')
  const category = searchParams.get('type') || 'women'

  useEffect(() => {
    setUser(getAuthUser())
    fetchProducts()
    fetchSubCategories()
  }, [category, sortBy, selectedSubCategory])

  const fetchProducts = async () => {
    try {
      const res = await fetch(`/api/products/category/${encodeURIComponent(category)}?sort=${sortBy}`)
      const result = await res.json()
      const decrypted = decryptData(result.data)
      let filteredProducts = decrypted.products || []
      
      if (selectedSubCategory) {
        filteredProducts = filteredProducts.filter((p: any) => p.prodSubCategoryName === selectedSubCategory)
      }
      
      setProducts(filteredProducts)
    } catch (error) {
      console.error('Failed to fetch products:', error)
    }
  }

  const fetchSubCategories = async () => {
    try {
      const res = await fetch(`/api/subcategories?categoryName=${encodeURIComponent(category)}&activeOnly=true`)
      const result = await res.json()
      const decrypted = decryptData(result.data)
      setSubCategories(decrypted.subcategories || [])
    } catch (error) {
      console.error('Failed to fetch subcategories:', error)
    }
  }

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
      <CustomerHeader user={user} onCartOpen={() => setIsCartOpen(true)} />

      <div className={styles.content}>
        <h1 className={styles.title}>{category.charAt(0).toUpperCase() + category.slice(1)}</h1>

        <div className={styles.filterBar}>
          <div className={styles.filters}>
            <button 
              className={`${styles.filterBtn} ${!selectedSubCategory ? styles.active : ''}`}
              onClick={() => setSelectedSubCategory(null)}
            >
              All
            </button>
            {subCategories.map((subCat) => (
              <button 
                key={subCat.id} 
                className={`${styles.filterBtn} ${selectedSubCategory === subCat.name ? styles.active : ''}`}
                onClick={() => setSelectedSubCategory(subCat.name)}
              >
                {subCat.name}
              </button>
            ))}
          </div>
          <div className={styles.sort}>
            <span>Sort by</span>
            <select className={styles.sortSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
          </div>
        </div>

        <div className={styles.products}>
          {products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#666', gridColumn: '1 / -1' }}>
              <p>No products available in this category</p>
            </div>
          ) : (
            products.map((product) => (
              <div key={product.id} className={styles.product} onClick={() => router.push(`/customer/product?id=${product.id}`)}>
                <div className={styles.productImage}>
                  <img src={product.prodImg || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt={product.prodName} />
                </div>
                <div className={styles.productName}>{product.prodName}</div>
                <div className={styles.productPrice}>LKR {product.prodPrice}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <CustomerFooter />

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
