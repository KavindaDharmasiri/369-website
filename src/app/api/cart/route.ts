import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { encryptData } from '@/lib/encryption'
import { getActiveDiscounts, bestDiscountForProduct, buildDiscountInfo } from '@/lib/discounts'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    const { productId, skuId, quantity, specs } = await request.json()

    // Check if item already exists in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        userId: decoded.userId,
        productId,
        skuId: skuId || null,
        specs: specs ? JSON.stringify(specs) : null
      }
    })

    let cartItem
    if (existingItem) {
      // Update quantity if item exists
      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + (quantity || 1) }
      })
    } else {
      // Create new item
      cartItem = await prisma.cartItem.create({
        data: {
          userId: decoded.userId,
          productId,
          skuId,
          quantity: quantity || 1,
          specs: specs ? JSON.stringify(specs) : null
        }
      })
    }

    return NextResponse.json({ data: encryptData({ cartItem }) })
  } catch (error) {
    console.error('Add to cart error:', error)
    return NextResponse.json({ error: 'Failed to add to cart' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: decoded.userId },
      include: { product: true, sku: true }
    })

    const discounts = await getActiveDiscounts(prisma)
    const enriched = cartItems.map((item: any) => {
      const product = item.product
      const basePrice = item.sku ? Number(item.sku.price) : Number(product.prodPrice)
      const best = bestDiscountForProduct(discounts, product)
      const info = buildDiscountInfo(basePrice, best)
      return { ...item, ...info }
    })

    return NextResponse.json({ data: encryptData({ cartItems: enriched }) })
  } catch (error) {
    console.error('Get cart error:', error)
    return NextResponse.json({ error: 'Failed to get cart' }, { status: 500 })
  }
}
