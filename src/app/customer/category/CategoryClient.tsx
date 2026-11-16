'use client'
import styles from './category.module.css'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useClientAuthUser } from '@/lib/useClientAuthUser'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import CustomerHeader from '@/components/CustomerHeader'
import CustomerFooter from '@/components/CustomerFooter'
import Cart from '@/components/Cart'
import { CardsSkeleton } from '@/components/Skeleton'

function CategoryContent({
  initialType = '',
  initialProducts = [],
  initialSubCategories = [],
}: {
  initialType?: string
  initialProducts?: any[]
  initialSubCategories?: any[]
}) {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const user = useClientAuthUser()
  const subCategories = initialSubCategories
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('newest')
  const category = initialType || 'women'
  // Filter/sort the server-resolved window. This is not global pagination.
  const products = initialProducts
    .filter(product => !selectedSubCategory || product.prodSubCategoryName === selectedSubCategory)
    .sort((a, b) => {
      if (sortBy === 'price_low') return Number(a.salePrice ?? a.prodPrice) - Number(b.salePrice ?? b.prodPrice)
      if (sortBy === 'price_high') return Number(b.salePrice ?? b.prodPrice) - Number(a.salePrice ?? a.prodPrice)
      const difference = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortBy === 'oldest' ? difference : -difference
    })

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
            products.map((product) => {
              const isOnSale = product.isOnSale === true && Number(product.salePrice) < Number(product.prodPrice)
              return (
                <Link key={product.id} href={`/customer/product?id=${product.slug || product.id}`} className={styles.product}>
                  <div className={`${styles.productImage} ${styles.productImageWrap}`}>
                    {isOnSale && <span className={styles.saleBadge}>{product.discountPercent}% OFF</span>}
                    <img src={getOptimizedImageUrl(product.prodImg) || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} alt={product.prodName} loading="lazy" decoding="async" />
                  </div>
                  <div className={styles.productName}>{product.prodName}</div>
                  <div className={styles.productPriceRow}>
                    <div className={`${styles.productPrice} ${isOnSale ? styles.salePrice : ''}`}>LKR {Number(product.salePrice ?? product.prodPrice).toLocaleString()}</div>
                    {isOnSale && <div className={styles.originalPrice}>LKR {Number(product.originalPrice).toLocaleString()}</div>}
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>

      <CustomerFooter />

      <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  )
}

export default function Category({
  initialType = '',
  initialProducts = [],
  initialSubCategories = [],
}: {
  initialType?: string
  initialProducts?: any[]
  initialSubCategories?: any[]
}) {
  return (
    <Suspense fallback={<div style={{ padding: '60px 20px', textAlign: 'center' }}><CardsSkeleton count={8} /></div>}>
      <CategoryContent
        key={initialType}
        initialType={initialType}
        initialProducts={initialProducts}
        initialSubCategories={initialSubCategories}
      />
    </Suspense>
  )
}
