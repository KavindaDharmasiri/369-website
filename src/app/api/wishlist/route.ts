import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { encryptData } from '@/lib/encryption'
import { getActiveDiscounts, bestDiscountForProduct, buildDiscountInfo } from '@/lib/discounts'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    const wishlist = await prisma.wishlistItem.findMany({
      where: { userId: decoded.userId },
      include: { product: true, sku: true },
      orderBy: { createdAt: 'desc' }
    })

    const discounts = await getActiveDiscounts(prisma)
    const enriched = wishlist.map((item: any) => {
      const product = item.product
      const basePrice = item.sku ? Number(item.sku.price) : Number(product.prodPrice)
      const best = bestDiscountForProduct(discounts, product)
      const info = buildDiscountInfo(basePrice, best)
      return { ...item, ...info }
    })

    return NextResponse.json({ data: encryptData({ wishlist: enriched }) })
  } catch (error) {
    console.error('Get wishlist error:', error)
    return NextResponse.json({ error: 'Failed to get wishlist' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    const { productId, skuId } = await request.json()

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const existing = await prisma.wishlistItem.findFirst({
      where: {
        userId: decoded.userId,
        productId,
        skuId: skuId || null
      }
    })

    if (existing) {
      return NextResponse.json({ data: encryptData({ wishlistItem: existing, alreadyExists: true }) })
    }

    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        userId: decoded.userId,
        productId,
        skuId: skuId || null
      }
    })

    return NextResponse.json({ data: encryptData({ wishlistItem }) })
  } catch (error) {
    console.error('Add to wishlist error:', error)
    return NextResponse.json({ error: 'Failed to add to wishlist' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const skuId = searchParams.get('skuId')

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    await prisma.wishlistItem.deleteMany({
      where: {
        userId: decoded.userId,
        productId: parseInt(productId),
        skuId: skuId ? parseInt(skuId) : null
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove from wishlist error:', error)
    return NextResponse.json({ error: 'Failed to remove from wishlist' }, { status: 500 })
  }
}
