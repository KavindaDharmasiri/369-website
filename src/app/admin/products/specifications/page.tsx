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
  const [showOptionsMenu, setShowOptionsMenu] = useState<number | null>(null)
  const [specs, setSpecs] = useState<any[]>([])
  const [specName, setSpecName] = useState('')
  const [specDesc, setSpecDesc] = useState('')
  const [attributes, setAttributes] = useState([{ name: '', value: '' }])
  const [attributeType, setAttributeType] = useState('text')
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showOptionsMenu !== null) {
        setShowOptionsMenu(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showOptionsMenu])

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
        attributes: attributes.filter(a => a.name && a.value).map(a => ({ ...a, type: attributeType }))
      })
    })

    if (res.ok) {
      setShowModal(false)
      setEditModal(false)
      setSelectedSpec(null)
      setSpecName('')
      setSpecDesc('')
      setAttributes([{ name: '', value: '' }])
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
    setAttributes(spec.attributes.length > 0 ? spec.attributes.map((a: any) => ({ name: a.name, value: a.value })) : [{ name: '', value: '' }])
    setAttributeType(spec.attributes.length > 0 && spec.attributes[0].type ? spec.attributes[0].type : 'text')
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
            <button className={styles.addBtn} onClick={() => { setSelectedSpec(null); setSpecName(''); setSpecDesc(''); setAttributes([{ name: '', value: '' }]); setAttributeType('text'); setShowModal(true); }}>Add Specifications</button>
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
                        <div className={styles.actionBtns}>
                          <button className={styles.actionBtn} onClick={() => handleView(spec)} title="View">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          </button>
                          <button className={styles.actionBtn} onClick={() => handleEdit(spec)} title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <div className={styles.moreMenu}>
                            <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); setShowOptionsMenu(showOptionsMenu === spec.id ? null : spec.id); }} title="More">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2"/>
                                <circle cx="12" cy="12" r="2"/>
                                <circle cx="12" cy="19" r="2"/>
                              </svg>
                            </button>
                            {showOptionsMenu === spec.id && (
                              <div className={styles.optionsDropdown}>
                                <button onClick={() => { setSelectedSpec(spec); setDeleteModal(true); setShowOptionsMenu(null); }}>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
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
            <button className={styles.updateBtn} onClick={handleNext}>Update as Draft & Next</button>
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
              <div className={styles.specSection}>
                <h3>SPECIFICATION</h3>
                
                <div className={styles.field}>
                  <label>NAME</label>
                  <input type="text" className={styles.input} value={specName} onChange={(e) => setSpecName(e.target.value)} />
                </div>
                
                <div className={styles.field}>
                  <label>DESCRIPTION</label>
                  <textarea className={styles.textarea} rows={4} value={specDesc} onChange={(e) => setSpecDesc(e.target.value)} />
                </div>
              </div>

              <div className={styles.attrSection}>
                <div className={styles.attrHeader}>
                  <h3>ATTRIBUTES</h3>
                  <button className={styles.addAttrBtn} onClick={() => setAttributes([...attributes, { name: '', value: '' }])}>+ Add</button>
                </div>
                
                <div className={styles.field}>
                  <label>ATTRIBUTE TYPE</label>
                  <select 
                    className={styles.attrSelect}
                    value={attributeType}
                    onChange={(e) => setAttributeType(e.target.value)}
                  >
                    <option value="text">Text</option>
                    <option value="color">Color</option>
                  </select>
                </div>

                {attributes.map((attr, index) => (
                  <div key={index} className={styles.attrRow}>
                    <input 
                      type="text" 
                      placeholder="Attribute Name" 
                      className={styles.attrInput} 
                      value={attr.name}
                      onChange={(e) => {
                        const newAttrs = [...attributes]
                        newAttrs[index].name = e.target.value
                        setAttributes(newAttrs)
                      }}
                    />
                    {attributeType === 'color' ? (
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
                        className={styles.attrInput} 
                        value={attr.value}
                        onChange={(e) => {
                          const newAttrs = [...attributes]
                          newAttrs[index].value = e.target.value
                          setAttributes(newAttrs)
                        }}
                      />
                    )}
                    <button className={styles.deleteAttrBtn} onClick={() => attributes.length > 1 && setAttributes(attributes.filter((_, i) => i !== index))} disabled={attributes.length === 1}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.saveBtn} onClick={handleSaveSpec}>SAVE</button>
              <button className={styles.closeModalBtn} onClick={() => { setShowModal(false); setSelectedSpec(null); setSpecName(''); setSpecDesc(''); setAttributes([{ name: '', value: '' }]); setAttributeType('text'); }}>CLOSE</button>
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
              <div className={styles.specSection}>
                <h3>SPECIFICATION</h3>
                <div className={styles.field}>
                  <label>NAME</label>
                  <input type="text" className={styles.input} value={selectedSpec.name} readOnly />
                </div>
                <div className={styles.field}>
                  <label>DESCRIPTION</label>
                  <textarea className={styles.textarea} rows={4} value={selectedSpec.description || ''} readOnly />
                </div>
              </div>
              <div className={styles.attrSection}>
                <h3>ATTRIBUTES</h3>
                <div className={styles.field}>
                  <label>ATTRIBUTE TYPE</label>
                  <input type="text" className={styles.input} value={selectedSpec.attributes.length > 0 && selectedSpec.attributes[0].type ? selectedSpec.attributes[0].type.toUpperCase() : 'TEXT'} readOnly />
                </div>
                {selectedSpec.attributes.map((attr: any, index: number) => (
                  <div key={index} className={styles.attrRow}>
                    <input type="text" className={styles.attrInput} value={attr.name} readOnly />
                    {attr.type === 'color' ? (
                      <input type="color" className={styles.colorInput} value={attr.value} disabled />
                    ) : (
                      <input type="text" className={styles.attrInput} value={attr.value} readOnly />
                    )}
                    <div style={{width: '40px'}}></div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.closeModalBtn} onClick={() => setViewModal(false)}>CLOSE</button>
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
              <div className={styles.specSection}>
                <h3>SPECIFICATION</h3>
                <div className={styles.field}>
                  <label>NAME</label>
                  <input type="text" className={styles.input} value={specName} onChange={(e) => setSpecName(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label>DESCRIPTION</label>
                  <textarea className={styles.textarea} rows={4} value={specDesc} onChange={(e) => setSpecDesc(e.target.value)} />
                </div>
              </div>
              <div className={styles.attrSection}>
                <div className={styles.attrHeader}>
                  <h3>ATTRIBUTES</h3>
                  <button className={styles.addAttrBtn} onClick={() => setAttributes([...attributes, { name: '', value: '' }])}>+ Add</button>
                </div>
                
                <div className={styles.field}>
                  <label>ATTRIBUTE TYPE</label>
                  <select 
                    className={styles.attrSelect}
                    value={attributeType}
                    onChange={(e) => setAttributeType(e.target.value)}
                  >
                    <option value="text">Text</option>
                    <option value="color">Color</option>
                  </select>
                </div>

                {attributes.map((attr, index) => (
                  <div key={index} className={styles.attrRow}>
                    <input type="text" placeholder="Attribute Name" className={styles.attrInput} value={attr.name} onChange={(e) => { const newAttrs = [...attributes]; newAttrs[index].name = e.target.value; setAttributes(newAttrs); }} />
                    {attributeType === 'color' ? (
                      <input type="color" className={styles.colorInput} value={attr.value || '#000000'} onChange={(e) => { const newAttrs = [...attributes]; newAttrs[index].value = e.target.value; setAttributes(newAttrs); }} />
                    ) : (
                      <input type="text" placeholder="Attribute Value" className={styles.attrInput} value={attr.value} onChange={(e) => { const newAttrs = [...attributes]; newAttrs[index].value = e.target.value; setAttributes(newAttrs); }} />
                    )}
                    <button className={styles.deleteAttrBtn} onClick={() => attributes.length > 1 && setAttributes(attributes.filter((_, i) => i !== index))} disabled={attributes.length === 1}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.saveBtn} onClick={handleSaveSpec}>UPDATE</button>
              <button className={styles.closeModalBtn} onClick={() => setEditModal(false)}>CLOSE</button>
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
