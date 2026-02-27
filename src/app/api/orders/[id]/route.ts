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
        orderItems: true 
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Fetch product and SKU details for each order item
    const enrichedItems = await Promise.all(
      order.orderItems.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { prodImg: true }
        })
        
        let skuImage = null
        if (item.skuId) {
          const sku = await prisma.productSku.findUnique({
            where: { id: item.skuId },
            select: { images: true }
          })
          if (sku?.images) {
            const images = JSON.parse(sku.images)
            skuImage = images[0]
          }
        }
        
        return {
          ...item,
          image: skuImage || product?.prodImg || null
        }
      })
    )

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

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status }
    })

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('Update order status error:', error)
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
  }
}