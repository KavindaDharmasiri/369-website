'use client'
import styles from './add.module.css'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { decryptData } from '@/lib/clientEncryption'
import { useLoading } from '@/lib/LoadingContext'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function AddProduct() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showLoading, hideLoading } = useLoading()
  const productId = searchParams.get('id')
  const mode = searchParams.get('mode') || 'add'
  const isViewMode = mode === 'view'
  const isEditMode = mode === 'edit'
  const [user, setUser] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [subCategories, setSubCategories] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('details')
  const [specs, setSpecs] = useState<any[]>([])
  const [skus, setSkus] = useState<any[]>([])
  const [showImageModal, setShowImageModal] = useState(false)
  const [mediaTab, setMediaTab] = useState('device')
  const [productImages, setProductImages] = useState<string[]>([])
  const [selectedImage, setSelectedImage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    status: 'INACTIVE',
    stockStatus: true,
    prodMarket: 'DRAFT',
    prodType: 'Product',
    categoryId: '',
    subCategoryId: '',
    prodCategoryName: '',
    prodSubCategoryName: '',
    prodName: '',
    prodSubtitle: '',
    prodDescription: '',
    prodImg: '',
    prodPrice: '',
    chargeTax: false,
    tagsCategory: '',
    tagsMeta: '',
    tagsGa4: '',
    visiPage: '',
    visiSection: '',
    returnPolicyDoc: '',
  })

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser || authUser.userType !== 'admin') {
      router.push('/signin')
      return
    }
    setUser(authUser)
    const loadData = async () => {
      showLoading()
      await fetchCategories()
      if (productId) {
        await fetchProduct(productId)
        await fetchSpecs(productId)
        await fetchSkus(productId)
      }
      hideLoading()
    }
    loadData()
  }, [router, productId])

  const fetchProduct = async (id: string) => {
    const token = localStorage.getItem('authToken')
    const res = await fetch(`/api/products/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const result = await res.json()
    const product = decryptData(result.data)
    
    // Fetch product images
    const imagesRes = await fetch(`/api/products/${id}/images`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const imagesData = await imagesRes.json()
    const images = imagesData.images || []
    setProductImages(images.map((img: any) => img.imageUrl))
    
    setFormData({
      status: product.status,
      stockStatus: product.stockStatus,
      prodMarket: product.prodMarket,
      prodType: product.prodType,
      categoryId: product.categoryId.toString(),
      subCategoryId: product.subCategoryId.toString(),
      prodCategoryName: product.prodCategoryName,
      prodSubCategoryName: product.prodSubCategoryName,
      prodName: product.prodName,
      prodSubtitle: product.prodSubtitle || '',
      prodDescription: product.prodDescription,
      prodImg: product.prodImg,
      prodPrice: product.prodPrice.toString(),
      chargeTax: product.chargeTax,
      tagsCategory: product.tagsCategory || '',
      tagsMeta: product.tagsMeta || '',
      tagsGa4: product.tagsGa4 || '',
      visiPage: product.visiPage || '',
      visiSection: product.visiSection || '',
      returnPolicyDoc: product.returnPolicyDoc || '',
    })
    fetchSubCategories(product.categoryId.toString())
  }

  const fetchSpecs = async (prodId: string) => {
    const token = localStorage.getItem('authToken')
    const res = await fetch(`/api/products/${prodId}/specs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    setSpecs(data || [])
  }

  const fetchSkus = async (prodId: string) => {
    const token = localStorage.getItem('authToken')
    const res = await fetch(`/api/products/${prodId}/skus`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    setSkus(data || [])
  }

  const fetchCategories = async () => {
    const token = localStorage.getItem('authToken')
    const res = await fetch('/api/categories', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const result = await res.json()
    const decrypted = decryptData(result.data)
    setCategories(decrypted.categories || [])
  }

  const fetchSubCategories = async (categoryId: string) => {
    const token = localStorage.getItem('authToken')
    const res = await fetch(`/api/subcategories?categoryId=${categoryId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const result = await res.json()
    const decrypted = decryptData(result.data)
    setSubCategories(decrypted.subcategories || [])
  }

  const handleCategoryChange = (e: any) => {
    const categoryId = e.target.value
    const category = categories.find(c => c.id === parseInt(categoryId))
    setFormData({ ...formData, categoryId, prodCategoryName: category?.name || '', subCategoryId: '', prodSubCategoryName: '' })
    fetchSubCategories(categoryId)
  }

  const handleSubCategoryChange = (e: any) => {
    const subCategoryId = e.target.value
    const subCategory = subCategories.find(s => s.id === parseInt(subCategoryId))
    setFormData({ ...formData, subCategoryId, prodSubCategoryName: subCategory?.name || '' })
  }

  const handleImageUpload = async (e: any) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploading(true)
    showLoading()
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

    if (uploadedUrls.length > 0) {
      const newImages = [...productImages, ...uploadedUrls]
      setProductImages(newImages)
      if (!formData.prodImg) {
        setFormData(prev => ({ ...prev, prodImg: uploadedUrls[0] }))
      }
    }
    hideLoading()
    setUploading(false)
  }

  const handleRemoveImage = (index: number) => {
    const newImages = productImages.filter((_, i) => i !== index)
    setProductImages(newImages)
    if (index === 0 && newImages.length > 0) {
      setFormData(prev => ({ ...prev, prodImg: newImages[0] }))
    } else if (newImages.length === 0) {
      setFormData(prev => ({ ...prev, prodImg: '' }))
    }
  }

  const handlePolicyUpload = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    const token = localStorage.getItem('authToken')
    const res = await fetch('/api/upload', { 
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData 
    })
    const data = await res.json()
    const isPdf = file.type === 'application/pdf'
    setFormData(prev => ({ ...prev, returnPolicyDoc: data.url, returnPolicyType: isPdf ? 'pdf' : 'image' }))
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setSaving(true)
    showLoading()

    const token = localStorage.getItem('authToken')
    const url = productId ? `/api/products/${productId}` : '/api/products'
    const method = productId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData),
    })

    if (res.ok) {
      const result = await res.json()
      const product = decryptData(result.data)
      const targetProductId = productId || product.productId
      
      // Save product images
      if (productImages.length > 0) {
        await fetch(`/api/products/${targetProductId}/images`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ images: productImages })
        })
      }
      
      if (!productId) {
        sessionStorage.setItem('currentProductId', targetProductId)
      }
      hideLoading()
      router.push(`/admin/products/specifications?productId=${targetProductId}`)
    }
    hideLoading()
    setSaving(false)
  }

  if (!user) return null

  return (
    <div className={styles.container}>
      <AdminSidebar userEmail={user.email} />

      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.pageTitle}>{isViewMode ? 'View Product' : isEditMode ? 'Edit Product' : 'Add Product'}</h1>
              <div className={styles.breadcrumb}>
                <Link href="/admin" className={styles.breadcrumbLink}>Dashboard</Link>
                <span className={styles.separator}>/</span>
                <Link href="/admin/products" className={styles.breadcrumbLink}>Products</Link>
                <span className={styles.separator}>/</span>
                <span>{isViewMode ? 'View' : isEditMode ? 'Edit' : 'Add'} Product</span>
              </div>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>Basic Information</h2>
              <div className={styles.topRow}>
                <div className={styles.field}>
                  <label>Product Status</label>
                  <select className={styles.select} value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} disabled={isViewMode}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Stock Status</label>
                  <div className={styles.radioGroup}>
                    <label className={styles.radio}>
                      <input type="checkbox" checked={formData.stockStatus} onChange={(e) => setFormData({...formData, stockStatus: e.target.checked})} disabled={isViewMode} />
                      <span>In Stock</span>
                    </label>
                  </div>
                </div>
                <div className={styles.field}>
                  <label>Marketplace</label>
                  <select className={styles.select} value={formData.prodMarket} onChange={(e) => setFormData({...formData, prodMarket: e.target.value})} disabled={isViewMode}>
                    <option value="DRAFT">Draft</option>
                    <option value="MARKETPLACE">Publish</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>Product Classification</h2>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Product Type</label>
                  <select className={styles.select} value={formData.prodType} onChange={(e) => setFormData({...formData, prodType: e.target.value})} disabled={isViewMode}>
                    <option value="Product">Product</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Category *</label>
                  <select className={styles.select} value={formData.categoryId} onChange={handleCategoryChange} required disabled={isViewMode}>
                    <option value="">Select Category</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Subcategory *</label>
                  <select className={styles.select} value={formData.subCategoryId} onChange={handleSubCategoryChange} required disabled={isViewMode}>
                    <option value="">Select Subcategory</option>
                    {subCategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>Product Information</h2>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Product Name/Title *</label>
                  <input type="text" className={styles.input} value={formData.prodName} onChange={(e) => setFormData({...formData, prodName: e.target.value})} required disabled={isViewMode} />
                </div>
                <div className={styles.field}>
                  <label>Product Subtitle</label>
                  <input type="text" placeholder="Product Subtitle" className={styles.input} value={formData.prodSubtitle} onChange={(e) => setFormData({...formData, prodSubtitle: e.target.value})} disabled={isViewMode} />
                </div>
                <div className={styles.field}>
                  <label>Product Description *</label>
                  <input type="text" placeholder="Product description" className={styles.input} value={formData.prodDescription} onChange={(e) => setFormData({...formData, prodDescription: e.target.value})} required disabled={isViewMode} />
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>Pricing</h2>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Product Price (RS) *</label>
                  <input type="number" placeholder="0" className={styles.input} value={formData.prodPrice} onChange={(e) => setFormData({...formData, prodPrice: e.target.value})} required disabled={isViewMode} />
                </div>
                <div className={styles.field}>
                  <label>Charge Tax on Product</label>
                  <label className={styles.checkbox}>
                    <input type="checkbox" checked={formData.chargeTax} onChange={(e) => setFormData({...formData, chargeTax: e.target.checked})} disabled={isViewMode} />
                    <span>Charge TAX</span>
                  </label>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>Product Images</h2>
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
                    {productImages.map((url, index) => (
                      <div key={index} className={styles.mediaItem}>
                        {index === 0 && <span className={styles.mainBadge}>Main</span>}
                        <img src={url} alt={`Product ${index + 1}`} onClick={() => { setSelectedImage(url); setShowImageModal(true); }} />
                        <button type="button" className={styles.removeImgBtn} onClick={() => handleRemoveImage(index)}>✕</button>
                      </div>
                    ))}
                    <div className={styles.addMedia}>
                      <input type="file" multiple id="prodImg" className={styles.hiddenInput} onChange={handleImageUpload} disabled={isViewMode || uploading} />
                      <label htmlFor="prodImg" className={styles.addMediaLabel}>
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

            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>Tags</h2>
              
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Category Tags</label>
                  <input type="text" placeholder="Add category" className={styles.input} value={formData.tagsCategory} onChange={(e) => setFormData({...formData, tagsCategory: e.target.value})} disabled={isViewMode} />
                </div>
                <div className={styles.field}>
                  <label>Meta Tags</label>
                  <input type="text" placeholder="Add meta tags" className={styles.input} value={formData.tagsMeta} onChange={(e) => setFormData({...formData, tagsMeta: e.target.value})} disabled={isViewMode} />
                </div>
                <div className={styles.field}>
                  <label>GA-4 Meta Tags</label>
                  <input type="text" placeholder="Add GA-4 meta tags" className={styles.input} value={formData.tagsGa4} onChange={(e) => setFormData({...formData, tagsGa4: e.target.value})} disabled={isViewMode} />
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>Product Visibility</h2>
              
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Page</label>
                  <select className={styles.select} value={formData.visiPage} onChange={(e) => setFormData({...formData, visiPage: e.target.value})} disabled={isViewMode}>
                    <option value="">Select Page</option>
                    <option value="Dashboard">Dashboard</option>
                    <option value="Home">Home</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Section</label>
                  <select className={styles.select} value={formData.visiSection} onChange={(e) => setFormData({...formData, visiSection: e.target.value})} disabled={isViewMode}>
                    <option value="">Select Section</option>
                    <option value="Top Products">Top Products</option>
                    <option value="Featured">Featured</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              {isViewMode ? (
                <button type="button" onClick={() => router.push('/admin/products')} className={styles.submitBtn}>Back to Products</button>
              ) : (
                <button type="submit" className={styles.submitBtn} disabled={saving}>
                  {saving ? 'Saving...' : `💾 ${isEditMode ? 'Update' : 'Save as Draft'} & Next`}
                </button>
              )}
            </div>
          </form>
        </div>
      </main>

      {showImageModal && selectedImage && (
        <div className={styles.modalOverlay} onClick={() => setShowImageModal(false)}>
          <div className={styles.imageModal}>
            <button className={styles.closeBtn} onClick={() => setShowImageModal(false)}>✕</button>
            <img src={selectedImage} alt="Product" />
          </div>
        </div>
      )}
    </div>
  )
}
