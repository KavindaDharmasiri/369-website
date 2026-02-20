'use client'
import styles from './sku.module.css'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { decryptData } from '@/lib/clientEncryption'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

function GeneratedSKUContent() {
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
  const [viewModal, setViewModal] = useState(false)
  const [selectedSku, setSelectedSku] = useState<any>(null)
  const [skuCode, setSkuCode] = useState('')
  const [variantKeys, setVariantKeys] = useState('')
  const [variantDetails, setVariantDetails] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [skuImages, setSkuImages] = useState<string[]>([])
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState('')
  const [mediaTab, setMediaTab] = useState('device')
  const [uploading, setUploading] = useState(false)

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
    const result = await res.json()
    const decrypted = decryptData(result.data)
    setProduct(decrypted)
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

  const handleView = (sku: any) => {
    setSelectedSku(sku)
    setSkuCode(sku.skuCode)
    setVariantKeys(sku.variantKeys || '')
    setVariantDetails(sku.variantDetails || '')
    setDescription(sku.description || '')
    setPrice(sku.price.toString())
    setStock(sku.stock?.toString() || '0')
    setSkuImages(sku.images ? JSON.parse(sku.images) : [])
    setViewModal(true)
  }

  const handleEdit = (sku: any) => {
    setSelectedSku(sku)
    setSkuCode(sku.skuCode)
    setVariantKeys(sku.variantKeys || '')
    setVariantDetails(sku.variantDetails || '')
    setDescription(sku.description || '')
    setPrice(sku.price.toString())
    setStock(sku.stock?.toString() || '0')
    setSkuImages(sku.images ? JSON.parse(sku.images) : [])
    setEditModal(true)
  }

  const handleImageUpload = async (e: any) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploading(true)
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
    setUploading(false)
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
        stock: parseInt(stock) || 0,
        images: JSON.stringify(skuImages)
      })
    })

    if (res.ok) {
      setEditModal(false)
      setSelectedSku(null)
      fetchSkus(productId)
    }
  }

  const handlePublish = async () => {
    if (!productId) return

    const token = localStorage.getItem('authToken')
    const fetchRes = await fetch(`/api/products/${productId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const result = await fetchRes.json()
    const productData = decryptData(result.data)

    const updateRes = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        status: productData.status,
        stockStatus: productData.stockStatus,
        prodMarket: 'MARKETPLACE',
        prodType: productData.prodType,
        prodCategoryName: productData.prodCategoryName,
        prodName: productData.prodName,
        prodSubtitle: productData.prodSubtitle,
        prodDescription: productData.prodDescription,
        prodImg: productData.prodImg,
        prodPrice: productData.prodPrice,
        chargeTax: productData.chargeTax,
        tagsCategory: productData.tagsCategory,
        tagsMeta: productData.tagsMeta,
        tagsGa4: productData.tagsGa4,
        featuredOnHomepage: productData.featuredOnHomepage,
        showInNewArrivals: productData.showInNewArrivals,
        returnPolicyDoc: productData.returnPolicyDoc,
        prodSubCategoryName: productData.prodSubCategoryName,
        categoryId: productData.categoryId,
        subCategoryId: productData.subCategoryId
      })
    })

    if (updateRes.ok) {
      sessionStorage.removeItem('currentProductId')
      router.push('/admin/products')
    }
  }

  const handleFinish = async () => {
    if (!productId) return

    const token = localStorage.getItem('authToken')
    const fetchRes = await fetch(`/api/products/${productId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const result = await fetchRes.json()
    const productData = decryptData(result.data)

    const updateRes = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        status: productData.status,
        stockStatus: productData.stockStatus,
        prodMarket: 'DRAFT',
        prodType: productData.prodType,
        prodCategoryName: productData.prodCategoryName,
        prodName: productData.prodName,
        prodSubtitle: productData.prodSubtitle,
        prodDescription: productData.prodDescription,
        prodImg: productData.prodImg,
        prodPrice: productData.prodPrice,
        chargeTax: productData.chargeTax,
        tagsCategory: productData.tagsCategory,
        tagsMeta: productData.tagsMeta,
        tagsGa4: productData.tagsGa4,
        featuredOnHomepage: productData.featuredOnHomepage,
        showInNewArrivals: productData.showInNewArrivals,
        returnPolicyDoc: productData.returnPolicyDoc,
        prodSubCategoryName: productData.prodSubCategoryName,
        categoryId: productData.categoryId,
        subCategoryId: productData.subCategoryId
      })
    })

    if (updateRes.ok) {
      sessionStorage.removeItem('currentProductId')
      router.push('/admin/products')
    }
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
                        <button className={styles.actionBtn} onClick={() => handleView(sku)}>◎</button>
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
            <button className={styles.publishBtn} onClick={handlePublish}>Publish</button>
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
                <label>SKU CODE</label>
                <input type="text" className={styles.input} value={skuCode} disabled style={{background: '#f8f9fa'}} />
              </div>
              <div className={styles.field}>
                <label>VARIANT KEYS</label>
                <input type="text" className={styles.input} value={variantKeys} disabled style={{background: '#f8f9fa'}} />
              </div>
              <div className={styles.field}>
                <label>VARIANT DETAILS</label>
                <input type="text" className={styles.input} value={variantDetails} disabled style={{background: '#f8f9fa'}} />
              </div>
              <div className={styles.field}>
                <label>DESCRIPTION</label>
                <textarea className={styles.textarea} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label>PRICE</label>
                <input type="number" className={styles.input} value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label>STOCK QUANTITY</label>
                <input type="number" className={styles.input} value={stock} onChange={(e) => setStock(e.target.value)} min="0" />
              </div>
              <div className={styles.field}>
                <label>SKU IMAGES</label>
                <div className={styles.mediaManager}>
                  <div className={styles.mediaHeader}>
                    <span className={styles.mediaTitle}>💼 Media Manager</span>
                    <div className={styles.mediaTabs}>
                      <button 
                        type="button" 
                        className={`${styles.mediaTabBtn} ${mediaTab === 'device' ? styles.active : ''}`}
                        onClick={() => setMediaTab('device')}
                      >
                        Device Upload
                      </button>
                      <button 
                        type="button" 
                        className={`${styles.mediaTabBtn} ${mediaTab === 'ai' ? styles.active : ''}`}
                        onClick={() => setMediaTab('ai')}
                      >
                        ✨ AI Studio
                      </button>
                    </div>
                  </div>
                  
                  {mediaTab === 'device' ? (
                    <div className={styles.mediaGrid}>
                      {skuImages.map((url, index) => (
                        <div key={index} className={styles.mediaItem}>
                          {index === 0 && <span className={styles.mainBadge}>Main</span>}
                          <img src={url} alt={`SKU ${index + 1}`} onClick={() => { setSelectedImage(url); setShowImageModal(true); }} />
                          <button type="button" className={styles.removeImgBtn} onClick={() => handleRemoveImage(index)}>✕</button>
                        </div>
                      ))}
                      <div className={styles.addMedia}>
                        <input type="file" multiple id="skuImg" className={styles.hiddenInput} onChange={handleImageUpload} disabled={uploading} />
                        <label htmlFor="skuImg" className={styles.addMediaLabel}>
                          {uploading ? (
                            <>
                              <span>⏳</span>
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <span>+</span>
                              <span>Add Media</span>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.aiStudio}>
                      <div className={styles.aiHeader}>
                        <span>✨ AI Studio Generator</span>
                      </div>
                      <div className={styles.aiContent}>
                        <div className={styles.refImage}>
                          <span>Ref Image</span>
                        </div>
                        <div className={styles.aiOption}>
                          <span>Generate with Model?</span>
                          <label className={styles.switch}>
                            <input type="checkbox" />
                            <span className={styles.slider}></span>
                          </label>
                        </div>
                        <button type="button" className={styles.generateBtn}>Generate Variations →</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.saveBtn} onClick={handleUpdate}>UPDATE</button>
              <button className={styles.closeModalBtn} onClick={() => setEditModal(false)}>CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {viewModal && selectedSku && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>View SKU</h2>
              <button className={styles.closeBtn} onClick={() => setViewModal(false)}>✕</button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.field}>
                <label>SKU CODE</label>
                <input type="text" className={styles.input} value={skuCode} readOnly style={{background: '#f8f9fa'}} />
              </div>
              <div className={styles.field}>
                <label>VARIANT KEYS</label>
                <input type="text" className={styles.input} value={variantKeys} readOnly style={{background: '#f8f9fa'}} />
              </div>
              <div className={styles.field}>
                <label>VARIANT DETAILS</label>
                <input type="text" className={styles.input} value={variantDetails} readOnly style={{background: '#f8f9fa'}} />
              </div>
              <div className={styles.field}>
                <label>DESCRIPTION</label>
                <textarea className={styles.textarea} rows={4} value={description} readOnly style={{background: '#f8f9fa'}} />
              </div>
              <div className={styles.field}>
                <label>PRICE</label>
                <input type="number" className={styles.input} value={price} readOnly style={{background: '#f8f9fa'}} />
              </div>
              <div className={styles.field}>
                <label>STOCK QUANTITY</label>
                <input type="number" className={styles.input} value={stock} readOnly style={{background: '#f8f9fa'}} />
              </div>
              <div className={styles.field}>
                <label>SKU IMAGES</label>
                <div className={styles.mediaGrid}>
                  {skuImages.map((url, index) => (
                    <div key={index} className={styles.mediaItem}>
                      {index === 0 && <span className={styles.mainBadge}>Main</span>}
                      <img src={url} alt={`SKU ${index + 1}`} onClick={() => { setSelectedImage(url); setShowImageModal(true); }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.closeModalBtn} onClick={() => setViewModal(false)}>CLOSE</button>
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

export default function GeneratedSKU() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GeneratedSKUContent />
    </Suspense>
  )
}
