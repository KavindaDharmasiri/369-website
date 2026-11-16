import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { positiveId, readJsonObject, ValidationError } from '@/lib/validation'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const orderId = positiveId((await params).id)

    // Admin can view any order, customers only their own
    const order = await prisma.order.findFirst({
      where: decoded.userType === 'admin' 
        ? { id: orderId }
        : { id: orderId, userId: decoded.userId },
      include: { 
        orderItems: {
          include: {
            product: { select: { prodImg: true } },
            sku: { select: { images: true, skuCode: true } }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
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

    return NextResponse.json({ success: true, data: { ...order, orderItems: enrichedItems } }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Get order details error', error)
    return NextResponse.json({ error: 'Failed to fetch order details' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }
    if (decoded.userType !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const { status } = await readJsonObject(request)
    const orderId = positiveId((await params).id)

    const VALID_STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
    const normalizedStatus = String(status || '').toUpperCase()
    if (!VALID_STATUSES.includes(normalizedStatus)) {
      return NextResponse.json({ error: 'Invalid order status' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status: normalizedStatus }
    })

    return NextResponse.json({ success: true, data: order }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Update order status error', error)
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
import { logServerError } from '@/lib/serverLog'
