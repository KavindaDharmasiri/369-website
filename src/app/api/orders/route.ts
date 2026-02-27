import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    const { 
      email, firstName, lastName, address, apartment, city, state, zipCode, phone,
      subtotal, shippingFee, tax, total, paymentMethod, items 
    } = await request.json()

    // Validate required fields
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items in order' }, { status: 400 })
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Create order with complete transaction rollback on any failure
    const result = await prisma.$transaction(async (tx) => {
      // Validate stock availability first
      for (const item of items) {
        if (item.skuId) {
          const sku = await tx.productSku.findUnique({
            where: { id: item.skuId },
            select: { stock: true, isActive: true }
          })
          
          if (!sku || !sku.isActive) {
            throw new Error(`Product SKU ${item.skuId} not found or inactive`)
          }
          
          if (sku.stock < item.quantity) {
            throw new Error(`Insufficient stock for SKU ${item.skuId}. Available: ${sku.stock}, Requested: ${item.quantity}`)
          }
        }
      }

      // Create the order
      const newOrder = await tx.order.create({
        data: {
          userId: decoded.userId,
          orderNumber,
          email,
          firstName,
          lastName,
          address,
          apartment,
          city,
          state,
          zipCode,
          phone,
          subtotal,
          shippingFee,
          tax,
          total,
          paymentMethod,
          status: 'pending'
        }
      })

      // Create order items and update stock atomically
      for (const item of items) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            skuId: item.skuId,
            productName: item.name,
            specs: item.specs ? JSON.stringify(item.specs) : null,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity
          }
        })

        // Update stock if SKU exists
        if (item.skuId) {
          await tx.productSku.update({
            where: { id: item.skuId },
            data: { stock: { decrement: item.quantity } }
          })
        }
      }

      // Clear user's cart
      await tx.cartItem.deleteMany({
        where: { userId: decoded.userId }
      })

      return newOrder
    })

    return NextResponse.json({ 
      success: true, 
      data: { 
        orderNumber: result.orderNumber,
        orderId: result.id,
        status: result.status
      } 
    })
    
  } catch (error) {
    console.error('Create order error:', error)
    
    // Return specific error messages for better debugging
    if (error instanceof Error) {
      if (error.message.includes('Insufficient stock')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
    }
    
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  } finally {
    // Create audit trail in background without blocking response
    setImmediate(async () => {
      try {
        await prisma.auditTrail.create({
          data: {
            userId: decoded.userId,
            userEmail: decoded.email || email,
            action: 'ORDER_CREATED',
            entityType: 'Order',
            entityId: result?.id?.toString() || 'unknown',
            metadata: JSON.stringify({ orderNumber, total, itemCount: items.length }),
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown'
          }
        })
      } catch (auditError) {
        console.error('Background audit trail creation failed:', auditError)
      }
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    
    // Admin can see all orders, customers see only their orders
    const orders = await prisma.order.findMany({
      where: decoded.userType === 'admin' ? {} : { userId: decoded.userId },
      include: { orderItems: true },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ success: true, data: { orders } })
  } catch (error) {
    console.error('Get orders error:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
