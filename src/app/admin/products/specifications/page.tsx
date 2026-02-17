'use client'
import styles from './specifications.module.css'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

export default function ProductSpecifications() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlProductId = searchParams.get('productId')
  const [user, setUser] = useState<any>(null)
  const [productId, setProductId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [selectedSpec, setSelectedSpec] = useState<any>(null)
  const [specs, setSpecs] = useState<any[]>([])
  const [specName, setSpecName] = useState('')
  const [specDesc, setSpecDesc] = useState('')
  const [attributes, setAttributes] = useState([{ name: '', value: '', type: 'text' }])
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

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
    fetchSpecs(storedProductId)
  }, [router, urlProductId])

  const fetchSpecs = async (prodId: string) => {
    const token = localStorage.getItem('authToken')
    const res = await fetch(`/api/products/${prodId}/specs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    setSpecs(data || [])
  }

  const handleSaveSpec = async () => {
    if (!productId) return

    const token = localStorage.getItem('authToken')
    const url = selectedSpec ? `/api/products/${productId}/specs/${selectedSpec.id}` : `/api/products/${productId}/specs`
    const method = selectedSpec ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: specName,
        description: specDesc,
        attributes: attributes.filter(a => a.name && a.value)
      })
    })

    if (res.ok) {
      setShowModal(false)
      setEditModal(false)
      setSelectedSpec(null)
      setSpecName('')
      setSpecDesc('')
      setAttributes([{ name: '', value: '', type: 'text' }])
      fetchSpecs(productId)
    }
  }

  const handleView = (spec: any) => {
    setSelectedSpec(spec)
    setViewModal(true)
  }

  const handleEdit = (spec: any) => {
    setSelectedSpec(spec)
    setSpecName(spec.name)
    setSpecDesc(spec.description || '')
    setAttributes(spec.attributes.length > 0 ? spec.attributes : [{ name: '', value: '', type: 'text' }])
    setEditModal(true)
  }

  const handleDelete = async () => {
    if (!productId || !selectedSpec) return

    const token = localStorage.getItem('authToken')
    const res = await fetch(`/api/products/${productId}/specs/${selectedSpec.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (res.ok) {
      setDeleteModal(false)
      setSelectedSpec(null)
      fetchSpecs(productId)
    }
  }

  const handleNext = async () => {
    if (!productId) return

    const token = localStorage.getItem('authToken')
    const res = await fetch(`/api/products/${productId}/skus/generate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (res.ok) {
      router.push(`/admin/products/sku?productId=${productId}`)
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
                <span>Specifications</span>
              </div>
            </div>
            <button className={styles.addBtn} onClick={() => { setSelectedSpec(null); setSpecName(''); setSpecDesc(''); setAttributes([{ name: '', value: '', type: 'text' }]); setShowModal(true); }}>+ Add Specifications</button>
          </div>

          <h2 className={styles.sectionTitle}>Specification</h2>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order No.</th>
                  <th>Specifications Name</th>
                  <th>Specifications Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {specs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}>No specifications added</td>
                  </tr>
                ) : (
                  specs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((spec, index) => (
                    <tr key={spec.id}>
                      <td>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td>{spec.name}</td>
                      <td>{spec.description || '-'}</td>
                      <td>
                        <button className={styles.actionBtn} onClick={() => handleView(spec)}>◎</button>
                        <button className={styles.actionBtn} onClick={() => handleEdit(spec)}>✎</button>
                        <button className={styles.actionBtn} onClick={() => { setSelectedSpec(spec); setDeleteModal(true); }}>✕</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {specs.length > itemsPerPage && (
            <div className={styles.pagination}>
              <button 
                className={styles.pageBtn} 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className={styles.pageInfo}>Page {currentPage} of {Math.ceil(specs.length / itemsPerPage)}</span>
              <button 
                className={styles.pageBtn} 
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(specs.length / itemsPerPage), p + 1))}
                disabled={currentPage === Math.ceil(specs.length / itemsPerPage)}
              >
                Next
              </button>
            </div>
          )}

          <div className={styles.actions}>
            <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
            <button className={styles.updateBtn} onClick={handleNext}>✎ Update & Next</button>
            <button className={styles.nextBtn} onClick={handleNext}>→ Next</button>
          </div>
        </div>
      </main>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Product Specification</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.section}>
                <h3>Specification</h3>
                
                <div className={styles.field}>
                  <label>Name</label>
                  <input type="text" placeholder="Enter Specification Name" className={styles.input} value={specName} onChange={(e) => setSpecName(e.target.value)} />
                </div>
                
                <div className={styles.field}>
                  <label>Description</label>
                  <textarea placeholder="Type Here..." className={styles.textarea} rows={4} value={specDesc} onChange={(e) => setSpecDesc(e.target.value)} />
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3>Attributes</h3>
                  <button className={styles.addAttrBtn} onClick={() => setAttributes([...attributes, { name: '', value: '', type: 'text' }])}>+ Add</button>
                </div>
                
                {attributes.map((attr, index) => (
                  <div key={index} className={styles.attrRow}>
                    <input 
                      type="text" 
                      placeholder="Attribute Name" 
                      className={styles.input} 
                      value={attr.name}
                      onChange={(e) => {
                        const newAttrs = [...attributes]
                        newAttrs[index].name = e.target.value
                        setAttributes(newAttrs)
                      }}
                    />
                    <select 
                      className={styles.select}
                      value={attr.type}
                      onChange={(e) => {
                        const newAttrs = [...attributes]
                        newAttrs[index].type = e.target.value
                        setAttributes(newAttrs)
                      }}
                    >
                      <option value="text">Text</option>
                      <option value="color">Color</option>
                    </select>
                    {attr.type === 'color' ? (
                      <input 
                        type="color" 
                        className={styles.colorInput} 
                        value={attr.value || '#000000'}
                        onChange={(e) => {
                          const newAttrs = [...attributes]
                          newAttrs[index].value = e.target.value
                          setAttributes(newAttrs)
                        }}
                      />
                    ) : (
                      <input 
                        type="text" 
                        placeholder="Attribute Value" 
                        className={styles.input} 
                        value={attr.value}
                        onChange={(e) => {
                          const newAttrs = [...attributes]
                          newAttrs[index].value = e.target.value
                          setAttributes(newAttrs)
                        }}
                      />
                    )}
                    <button className={styles.deleteBtn} onClick={() => setAttributes(attributes.filter((_, i) => i !== index))}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.closeModalBtn} onClick={() => { setShowModal(false); setSelectedSpec(null); setSpecName(''); setSpecDesc(''); setAttributes([{ name: '', value: '', type: 'text' }]); }}>Close</button>
              <button className={styles.closeModalBtn} onClick={handleSaveSpec}>Save</button>
            </div>
          </div>
        </div>
      )}
      {viewModal && selectedSpec && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>View Specification</h2>
              <button className={styles.closeBtn} onClick={() => setViewModal(false)}>✕</button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.section}>
                <h3>Specification</h3>
                <div className={styles.field}>
                  <label>Name</label>
                  <p>{selectedSpec.name}</p>
                </div>
                <div className={styles.field}>
                  <label>Description</label>
                  <p>{selectedSpec.description || '-'}</p>
                </div>
              </div>
              <div className={styles.section}>
                <h3>Attributes</h3>
                {selectedSpec.attributes.map((attr: any, index: number) => (
                  <div key={index} className={styles.attrRow}>
                    <p><strong>{attr.name}:</strong> {attr.type === 'color' ? <span style={{backgroundColor: attr.value, padding: '5px 20px', border: '1px solid #ccc'}}>{attr.value}</span> : attr.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.closeModalBtn} onClick={() => setViewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editModal && selectedSpec && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Edit Specification</h2>
              <button className={styles.closeBtn} onClick={() => setEditModal(false)}>✕</button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.section}>
                <h3>Specification</h3>
                <div className={styles.field}>
                  <label>Name</label>
                  <input type="text" placeholder="Enter Specification Name" className={styles.input} value={specName} onChange={(e) => setSpecName(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label>Description</label>
                  <textarea placeholder="Type Here..." className={styles.textarea} rows={4} value={specDesc} onChange={(e) => setSpecDesc(e.target.value)} />
                </div>
              </div>
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3>Attributes</h3>
                  <button className={styles.addAttrBtn} onClick={() => setAttributes([...attributes, { name: '', value: '', type: 'text' }])}>+ Add</button>
                </div>
                {attributes.map((attr, index) => (
                  <div key={index} className={styles.attrRow}>
                    <input type="text" placeholder="Attribute Name" className={styles.input} value={attr.name} onChange={(e) => { const newAttrs = [...attributes]; newAttrs[index].name = e.target.value; setAttributes(newAttrs); }} />
                    <select className={styles.select} value={attr.type} onChange={(e) => { const newAttrs = [...attributes]; newAttrs[index].type = e.target.value; setAttributes(newAttrs); }}>
                      <option value="text">Text</option>
                      <option value="color">Color</option>
                    </select>
                    {attr.type === 'color' ? (
                      <input type="color" className={styles.colorInput} value={attr.value || '#000000'} onChange={(e) => { const newAttrs = [...attributes]; newAttrs[index].value = e.target.value; setAttributes(newAttrs); }} />
                    ) : (
                      <input type="text" placeholder="Attribute Value" className={styles.input} value={attr.value} onChange={(e) => { const newAttrs = [...attributes]; newAttrs[index].value = e.target.value; setAttributes(newAttrs); }} />
                    )}
                    <button className={styles.deleteBtn} onClick={() => setAttributes(attributes.filter((_, i) => i !== index))}>✕</button>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.closeModalBtn} onClick={() => setEditModal(false)}>Close</button>
              <button className={styles.closeModalBtn} onClick={handleSaveSpec}>Update</button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && selectedSpec && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Delete Specification</h2>
            </div>
            <div className={styles.modalContent}>
              <p>Are you sure you want to delete <strong>{selectedSpec.name}</strong>?</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.closeModalBtn} onClick={() => setDeleteModal(false)}>Cancel</button>
              <button className={styles.closeModalBtn} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
