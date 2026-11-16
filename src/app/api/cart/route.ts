import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { encryptData } from '@/lib/encryption'
import { getActiveDiscounts, bestDiscountForProduct, buildDiscountInfo } from '@/lib/discounts'
import { parseCartInput, readJsonObject, ValidationError } from '@/lib/validation'
import { appendCartLines, cartTransaction } from '@/lib/cartTransactions'
import { publicProductSelect } from '@/lib/publicProduct'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const privateNoStore = { 'Cache-Control': 'private, no-store' }
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateNoStore })
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: privateNoStore })
    const { productId, skuId, quantity } = parseCartInput(await readJsonObject(request))
    const [cartItem] = await cartTransaction(prisma, decoded.userId,
      tx => appendCartLines(tx, decoded.userId, [{ productId, skuId, quantity }]))

    return NextResponse.json({ success: true, data: encryptData({ cartItem }) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Add to cart error', error)
    return NextResponse.json({ error: 'Failed to add to cart' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    // A private bag is not permission to read internal product actors/tracking tags.
    // Explicit selection also avoids probing unapplied slug columns on every read.
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: decoded.userId },
      include: { product: { select: publicProductSelect }, sku: true },
    })

    const discounts = await getActiveDiscounts(prisma)
    const enriched = cartItems.map((item: any) => {
      const product = item.product
      const basePrice = item.sku ? Number(item.sku.price) : Number(product.prodPrice)
      const best = bestDiscountForProduct(discounts, product, basePrice)
      const info = buildDiscountInfo(basePrice, best)
      return { ...item, ...info }
    })

    return NextResponse.json({ data: encryptData({ cartItems: enriched }) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    logServerError('Get cart error', error)
    return NextResponse.json({ error: 'Failed to get cart' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
import { logServerError } from '@/lib/serverLog'
