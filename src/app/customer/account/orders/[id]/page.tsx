'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import styles from '../../account.module.css'

export default function OrderDetailsPage() {
  const params = useParams()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrderDetails()
  }, [params.id])

  const fetchOrderDetails = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch(`/api/orders/${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      if (result.success) {
        setOrder(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch order details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPaymentStatus = () => {
    if (order.paymentMethod.toLowerCase() === 'cash' && order.status.toLowerCase() !== 'delivered') {
      return 'not paid'
    }
    return 'paid'
  }

  const getPaymentStatusClass = () => {
    return getPaymentStatus() === 'paid' ? 'paid' : 'notPaid'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) return <div>Loading...</div>
  if (!order) return <div>Order not found</div>

  return (
    <div className={styles.orderDetails} style={{ position: 'relative' }}>
      
      <div className={`${styles.paymentStatus} ${styles[getPaymentStatusClass()]}`}>
        {getPaymentStatus()}
      </div>
      
      <h1>Order Details</h1>
      <p>Order #{order.orderNumber}</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '40px' }}>
        <div>
          <h3>Order Information</h3>
          <p><strong>Order Date:</strong> {formatDate(order.createdAt)}</p>
          <p><strong>Status:</strong> <span className={`${styles.status} ${styles[order.status.toLowerCase()]}`}>{order.status}</span></p>
          <p><strong>Payment Method:</strong> {order.paymentMethod}</p>
        </div>
        
        <div>
          <h3>Shipping Address</h3>
          <p>{order.firstName} {order.lastName}</p>
          <p>{order.address}</p>
          {order.apartment && <p>{order.apartment}</p>}
          <p>{order.city}, {order.state} {order.zipCode}</p>
          <p>{order.phone}</p>
        </div>
      </div>

      <h3>Order Items</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '40px' }}>
        {order.orderItems.map((item: any) => {
          const specs = item.specs ? JSON.parse(item.specs) : null
          return (
            <div key={item.id} style={{
              display: 'flex',
              gap: '16px',
              padding: '16px',
              background: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                flexShrink: 0,
                borderRadius: '6px',
                overflow: 'hidden',
                background: 'white'
              }}>
                <img 
                  src={item.image || "https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png"} 
                  alt={item.productName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{item.productName}</h4>
                {specs && (
                  <p style={{ fontSize: '12px', color: '#6c757d', margin: 0 }}>
                    {Object.values(specs).join(' / ')}
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#495057' }}>
                  <span>Qty: {item.quantity}</span>
                  <span>LKR {Number(item.price).toFixed(2)}</span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#212529' }}>
                  Total: LKR {Number(item.subtotal).toFixed(2)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          onClick={() => window.open(`/api/orders/${order.id}/pdf`, '_blank')}
          style={{
            padding: '12px 24px',
            background: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Download PDF
        </button>
        <div className={styles.orderSummary}>
          <p><strong>Subtotal:</strong> LKR {order.subtotal}</p>
          <p><strong>Shipping:</strong> LKR {order.shippingFee}</p>
          <p><strong>Tax:</strong> LKR {order.tax}</p>
          <hr />
          <p style={{ fontSize: '18px' }}><strong>Total: LKR {order.total}</strong></p>
        </div>
      </div>
    </div>
  )
}