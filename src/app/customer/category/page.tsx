'use client'
import styles from './category.module.css'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAuthUser } from '@/lib/auth'
import { decryptData } from '@/lib/clientEncryption'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'
import Cart from '@/components/Cart'

function CategoryContent() {
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

      <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  )
}

export default function Category() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CategoryContent />
    </Suspense>
  )
}
