'use client'
import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import { Skeleton } from '@/components/Skeleton'

const emptyForm = {
  firstName: '',
  lastName: '',
  address: '',
  apartment: '',
  city: '',
  state: '',
  zipCode: '',
  phone: ''
}

export default function AddressesPage() {
  const [form, setForm] = useState(emptyForm)
  const [savedAddress, setSavedAddress] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAddresses()
  }, [])

  const loadAddresses = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/addresses', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      const list = result.success ? (result.data || []) : []
      if (list.length > 0) {
        setSavedAddress(list[0])
        const a = list[0]
        setForm({
          firstName: a.firstName || '',
          lastName: a.lastName || '',
          address: a.address || '',
          apartment: a.apartment || '',
          city: a.city || '',
          state: a.state || '',
          zipCode: a.zipCode || '',
          phone: a.phone || ''
        })
      }
    } catch (error) {
      console.error('Failed to load addresses:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.address || !form.city || !form.state || !form.zipCode || !form.phone) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Fields',
        text: 'Please fill in all required address fields',
        confirmButtonColor: '#000'
      })
      return
    }

    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      })

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Address Saved!',
          text: 'Your delivery address has been updated',
          confirmButtonColor: '#000',
          timer: 2000
        })
        loadAddresses()
      } else {
        throw new Error('Failed to save address')
      }
    } catch (error) {
      console.error('Failed to save address:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to save address',
        confirmButtonColor: '#000'
      })
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px 0' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', color: '#2c3e50' }}>Addresses</h1>
        <p style={{ color: '#5a6c7d', marginBottom: '30px' }}>Manage your delivery address</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton height="80px" />
          <Skeleton height="80px" />
          <Skeleton height="120px" />
        </div>
      </div>
    )
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box'
  }

  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '6px', color: '#34495e', fontSize: '14px' }

  return (
    <div style={{ padding: '20px 0' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '8px', color: '#2c3e50' }}>Addresses</h1>
      <p style={{ color: '#5a6c7d', marginBottom: '30px' }}>Manage your delivery address</p>

      {savedAddress && (
        <div style={{ background: '#e8f5e8', color: '#2d5a2d', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '14px' }}>
          Default address: {savedAddress.address}, {savedAddress.city}, {savedAddress.state} {savedAddress.zipCode}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', maxWidth: '640px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: '18px', marginTop: 0, color: '#34495e' }}>Delivery Address</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>First Name</label>
            <input style={fieldStyle} value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Last Name</label>
            <input style={fieldStyle} value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={labelStyle}>Street Address</label>
          <input style={fieldStyle} value={form.address} onChange={(e) => updateField('address', e.target.value)} />
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={labelStyle}>Apartment / Suite (optional)</label>
          <input style={fieldStyle} value={form.apartment} onChange={(e) => updateField('apartment', e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>City</label>
            <input style={fieldStyle} value={form.city} onChange={(e) => updateField('city', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>State / Province</label>
            <input style={fieldStyle} value={form.state} onChange={(e) => updateField('state', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>ZIP / Postal Code</label>
            <input style={fieldStyle} value={form.zipCode} onChange={(e) => updateField('zipCode', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={fieldStyle} value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
          </div>
        </div>

        <button
          onClick={handleSave}
          style={{
            marginTop: '24px',
            width: '100%',
            padding: '14px',
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            cursor: 'pointer'
          }}
        >
          Save Address
        </button>
      </div>
    </div>
  )
}
