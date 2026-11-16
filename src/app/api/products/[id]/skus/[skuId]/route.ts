import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/apiMiddleware'

const putHandler = async (req: NextRequest, user: any, { params }: { params: Promise<{ id: string, skuId: string }> }) => {
  try {
    const { description, price, stock, images } = await req.json()
    
    const skuId = parseInt((await params).skuId)
    if (!Number.isInteger(skuId) || skuId < 1) {
      return NextResponse.json({ error: 'Invalid SKU id' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const data: any = {}
    if (description !== undefined) data.description = description
    if (price !== undefined) {
      const parsedPrice = parseFloat(price)
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) return NextResponse.json({ error: 'Invalid price' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
      data.price = parsedPrice
    }
    if (stock !== undefined) {
      const parsedStock = parseInt(stock)
      if (!Number.isInteger(parsedStock) || parsedStock < 0) return NextResponse.json({ error: 'Invalid stock' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
      data.stock = parsedStock
    }
    if (images !== undefined) data.images = images

    const updatedSku = await prisma.productSku.update({
      where: { id: skuId },
      data,
    })

    return NextResponse.json(updatedSku, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update SKU' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export const PUT = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => putHandler(r, u, context))(req)
