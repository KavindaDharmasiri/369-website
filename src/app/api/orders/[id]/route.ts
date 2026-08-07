import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    const orderId = parseInt(params.id)

    // Admin can view any order, customers only their own
    const order = await prisma.order.findFirst({
      where: decoded.userType === 'admin' 
        ? { id: orderId }
        : { id: orderId, userId: decoded.userId },
      include: { 
        orderItems: {
          include: {
            product: { select: { prodImg: true } },
            sku: { select: { images: true } }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Derive item images from SKU (if any) or product
    const enrichedItems = order.orderItems.map((item) => {
      let image = item.product?.prodImg || null
      if (item.sku?.images) {
        try {
          const images = JSON.parse(item.sku.images)
          image = images[0] || image
        } catch {
          // keep product image
        }
      }
      const { product, sku, ...rest } = item as any
      return { ...rest, image, skuCode: (sku as any)?.skuCode || null }
    })

    return NextResponse.json({ success: true, data: { ...order, orderItems: enrichedItems } })
  } catch (error) {
    console.error('Get order details error:', error)
    return NextResponse.json({ error: 'Failed to fetch order details' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (decoded.userType !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { status } = await request.json()
    const orderId = parseInt(params.id)

    const VALID_STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
    const normalizedStatus = String(status || '').toUpperCase()
    if (!VALID_STATUSES.includes(normalizedStatus)) {
      return NextResponse.json({ error: 'Invalid order status' }, { status: 400 })
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status: normalizedStatus }
    })

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('Update order status error:', error)
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
  }
}