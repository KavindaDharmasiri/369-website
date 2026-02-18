'use client'
import styles from './sku.module.css'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function GeneratedSKU() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlProductId = searchParams.get('productId')
  const [user, setUser] = useState<any>(null)
  const [productId, setProductId] = useState<string | null>(null)
  const [skus, setSkus] = useState<any[]>([])
  const [product, setProduct] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [editModal, setEditModal] = useState(false)
  const [selectedSku, setSelectedSku] = useState<any>(null)
  const [skuCode, setSkuCode] = useState('')
  const [variantDetails, setVariantDetails] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [skuImages, setSkuImages] = useState<string[]>([])
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState('')

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser || authUser.userType !== 'admin') {
      router.push('/signin')
      return
    }
    setUser(authUser)
    const storedProductId = urlProductId || sessionStorage.getItem('currentProductId')
    if (!storedProductId) {
      router.push('/admin/products')
      return
    }
    setProductId(storedProductId)
    fetchProduct(storedProductId)
    fetchSkus(storedProductId)
  }, [router, urlProductId])

  const fetchProduct = async (prodId: string) => {
    const token = localStorage.getItem('authToken')
    const res = await fetch(`/api/products/${prodId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    setProduct(data)
  }

  const fetchSkus = async (prodId: string) => {
    const token = localStorage.getItem('authToken')
    const res = await fetch(`/api/products/${prodId}/skus`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    setSkus(data || [])
  }

  const handleGenerateSkus = async () => {
    if (!productId) return

    const token = localStorage.getItem('authToken')
    const res = await fetch(`/api/products/${productId}/skus/generate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (res.ok) {
      fetchSkus(productId)
    }
  }

  const handleEdit = (sku: any) => {
    setSelectedSku(sku)
    setSkuCode(sku.skuCode)
    setVariantDetails(sku.variantDetails || '')
    setDescription(sku.description || '')
    setPrice(sku.price.toString())
    setSkuImages(sku.images ? JSON.parse(sku.images) : [])
    setEditModal(true)
  }

  const handleImageUpload = async (e: any) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const token = localStorage.getItem('authToken')
    const uploadedUrls: string[] = []

    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file as File)

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })
      const data = await res.json()
      if (data.url) uploadedUrls.push(data.url)
    }

    setSkuImages([...skuImages, ...uploadedUrls])
  }

  const handleRemoveImage = (index: number) => {
    setSkuImages(skuImages.filter((_, i) => i !== index))
  }

  const handleUpdate = async () => {
    if (!productId || !selectedSku) return

    const token = localStorage.getItem('authToken')
    const res = await fetch(`/api/products/${productId}/skus/${selectedSku.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        description,
        price: parseFloat(price),
        images: JSON.stringify(skuImages)
      })
    })

    if (res.ok) {
      setEditModal(false)
      setSelectedSku(null)
      fetchSkus(productId)
    }
  }

  const handleFinish = () => {
    sessionStorage.removeItem('currentProductId')
    router.push('/admin/products')
  }

  if (!user) return null

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.pageTitle}>Product</h1>
              <div className={styles.breadcrumb}>
                <Link href="/admin" className={styles.breadcrumbLink}>Dashboard</Link>
                <span className={styles.separator}>/</span>
                <Link href="/admin/products" className={styles.breadcrumbLink}>Products</Link>
                <span className={styles.separator}>/</span>
                <Link href="/admin/products/specifications" className={styles.breadcrumbLink}>Specifications</Link>
                <span className={styles.separator}>/</span>
                <span>Generated SKU</span>
              </div>
            </div>
          </div>

          <h2 className={styles.sectionTitle}>Generated SKU Table</h2>
          {skus.length === 0 && (
            <button className={styles.addBtn} onClick={handleGenerateSkus}>Generate SKUs</button>
          )}

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Id</th>
                  <th>SKU Code</th>
                  <th>Variant Keys</th>
                  <th>Variant Details</th>
                  <th>Price</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {skus.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>No SKUs generated. Click "Generate SKUs" button.</td>
                  </tr>
                ) : (
                  skus.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((sku) => (
                    <tr key={sku.id}>
                      <td>{sku.id}</td>
                      <td>{sku.skuCode}</td>
                      <td>{sku.variantKeys}</td>
                      <td>{sku.variantDetails}</td>
                      <td>LKR {sku.price}</td>
                      <td>
                        <button className={styles.actionBtn}>◎</button>
                        <button className={styles.actionBtn} onClick={() => handleEdit(sku)}>✎</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {skus.length > itemsPerPage && (
            <div className={styles.pagination}>
              <button 
                className={styles.pageBtn} 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className={styles.pageInfo}>Page {currentPage} of {Math.ceil(skus.length / itemsPerPage)}</span>
              <button 
                className={styles.pageBtn} 
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(skus.length / itemsPerPage), p + 1))}
                disabled={currentPage === Math.ceil(skus.length / itemsPerPage)}
              >
                Next
              </button>
            </div>
          )}

          <div className={styles.actions}>
            <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
            <button className={styles.finishBtn} onClick={handleFinish}>Finish</button>
          </div>
        </div>
      </main>

      {editModal && selectedSku && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Edit SKU</h2>
              <button className={styles.closeBtn} onClick={() => setEditModal(false)}>✕</button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.field}>
                <label>Sku Code</label>
                <input type="text" className={styles.input} value={skuCode} disabled style={{background: '#f8f9fa'}} />
              </div>
              <div className={styles.field}>
                <label>Variant Details</label>
                <input type="text" className={styles.input} value={variantDetails} disabled style={{background: '#f8f9fa'}} />
              </div>
              <div className={styles.field}>
                <label>Description</label>
                <textarea placeholder="Type Here..." className={styles.textarea} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label>Price</label>
                <input type="number" className={styles.input} value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label>SKU Images</label>
                <input type="file" multiple accept="image/*" onChange={handleImageUpload} className={styles.fileInput} />
                {skuImages.length > 0 && (
                  <div className={styles.imagesGrid}>
                    {skuImages.map((url, index) => (
                      <div key={index} className={styles.imageItem}>
                        <img src={url} alt={`SKU ${index + 1}`} onClick={() => { setSelectedImage(url); setShowImageModal(true); }} />
                        <button type="button" className={styles.removeBtn} onClick={() => handleRemoveImage(index)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.closeModalBtn} onClick={() => setEditModal(false)}>Close</button>
              <button className={styles.applyBtn} onClick={handleUpdate}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {showImageModal && (
        <div className={styles.modalOverlay} onClick={() => setShowImageModal(false)}>
          <div className={styles.imageModal}>
            <button className={styles.closeBtn} onClick={() => setShowImageModal(false)}>✕</button>
            <img src={selectedImage} alt="SKU" />
          </div>
        </div>
      )}
    </div>
  )
}
