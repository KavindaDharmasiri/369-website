import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { positiveId, readJsonObject, ValidationError } from '@/lib/validation'
import { encryptData } from '@/lib/encryption'
import { getActiveDiscounts, bestDiscountForProduct, buildDiscountInfo } from '@/lib/discounts'
import { publicProductSelect } from '@/lib/publicProduct'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const wishlist = await prisma.wishlistItem.findMany({
      where: { userId: decoded.userId },
      include: { product: { select: publicProductSelect }, sku: true },
      orderBy: { createdAt: 'desc' },
    })

    const discounts = await getActiveDiscounts(prisma)
    const enriched = wishlist.map((item: any) => {
      const product = item.product
      const basePrice = item.sku ? Number(item.sku.price) : Number(product.prodPrice)
      const best = bestDiscountForProduct(discounts, product, basePrice)
      const info = buildDiscountInfo(basePrice, best)
      return { ...item, ...info }
    })

    return NextResponse.json({ data: encryptData({ wishlist: enriched }) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    logServerError('Get wishlist error', error)
    return NextResponse.json({ error: 'Failed to get wishlist' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const privateNoStore = { 'Cache-Control': 'private, no-store' }
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateNoStore })
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: privateNoStore })
    }
    const body = await readJsonObject(request)
    const productId = positiveId(body.productId, 'Product ID')
    const skuId = body.skuId == null ? null : positiveId(body.skuId, 'SKU ID')
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true, prodMarket: true, isDeleted: true,
        category: { select: { isActive: true } }, subCategory: { select: { isActive: true } } },
    })
    if (!product || product.isDeleted || product.status !== 'ACTIVE' ||
        !['MARKETPLACE', 'BOTH'].includes(product.prodMarket) ||
        !product.category?.isActive || !product.subCategory?.isActive) {
      throw new ValidationError('Product not found', 404)
    }
    if (skuId !== null) {
      const sku = await prisma.productSku.findUnique({ where: { id: skuId }, select: { productId: true, isActive: true } })
      if (!sku || !sku.isActive || sku.productId !== productId) throw new ValidationError('SKU not found for this product', 404)
    }

    const existing = await prisma.wishlistItem.findFirst({
      where: {
        userId: decoded.userId,
        productId,
        skuId: skuId || null
      }
    })

    if (existing) {
      return NextResponse.json({ data: encryptData({ wishlistItem: existing, alreadyExists: true }) }, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        userId: decoded.userId,
        productId,
        skuId: skuId || null
      }
    })

    return NextResponse.json({ data: encryptData({ wishlistItem }) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Add to wishlist error', error)
    return NextResponse.json({ error: 'Failed to add to wishlist' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const privateNoStore = { 'Cache-Control': 'private, no-store' }
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateNoStore })
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: privateNoStore })
    }
    const { searchParams } = new URL(request.url)
    const productId = positiveId(searchParams.get('productId'), 'Product ID')
    const skuParam = searchParams.get('skuId')
    const skuId = skuParam === null ? null : positiveId(skuParam, 'SKU ID')

    await prisma.wishlistItem.deleteMany({
      where: {
        userId: decoded.userId,
        productId,
        skuId
      }
    })

    return NextResponse.json({ success: true }, { headers: privateNoStore })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Remove from wishlist error', error)
    return NextResponse.json({ error: 'Failed to remove from wishlist' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
import { logServerError } from '@/lib/serverLog'
