import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { encrypt } from '@/lib/encryption'
import { attachDiscountInfo } from '@/lib/discounts'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam) || 0, 50) : 50

    if (!q) {
      return NextResponse.json({ data: encrypt(JSON.stringify({ products: [] })) })
    }

    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        prodMarket: 'MARKETPLACE',
        isDeleted: false,
        OR: [
          { prodName: { contains: q, mode: 'insensitive' } },
          { prodSubtitle: { contains: q, mode: 'insensitive' } },
          { prodDescription: { contains: q, mode: 'insensitive' } },
          { tagsCategory: { contains: q, mode: 'insensitive' } },
          { tagsMeta: { contains: q, mode: 'insensitive' } },
          { prodCategoryName: { contains: q, mode: 'insensitive' } },
          { prodSubCategoryName: { contains: q, mode: 'insensitive' } }
        ]
      },
      include: { productImages: { orderBy: { isPrimary: 'desc' } } },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    const enriched = await attachDiscountInfo(prisma, products)

    const encrypted = encrypt(JSON.stringify({ products: enriched }))
    return NextResponse.json({ data: encrypted })
  } catch (error: any) {
    console.error('Search API Error:', error)
    const encrypted = encrypt(JSON.stringify({ error: error.message || 'Failed to search products' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}
