import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { encrypt } from '@/lib/encryption'
import { attachDiscountInfo } from '@/lib/discounts'

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params
    const categoryName = decodeURIComponent(name)
    const { searchParams } = new URL(req.url)
    const sort = searchParams.get('sort') || 'newest'
    const limitParam = searchParams.get('limit')

    let orderBy: any = { createdAt: 'desc' }
    if (sort === 'oldest') orderBy = { createdAt: 'asc' }
    else if (sort === 'price_low') orderBy = { prodPrice: 'asc' }
    else if (sort === 'price_high') orderBy = { prodPrice: 'desc' }

    const limit = limitParam ? Math.min(parseInt(limitParam) || 0, 50) : undefined

    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        prodMarket: 'MARKETPLACE',
        prodCategoryName: { equals: categoryName, mode: 'insensitive' }
      },
      select: limit ? { id: true, prodName: true, prodImg: true, prodPrice: true, categoryId: true, subCategoryId: true } : undefined,
      orderBy,
      take: limit
    })

    const enriched = await attachDiscountInfo(prisma, products)

    if (sort === 'price_low') enriched.sort((a: any, b: any) => Number(a.salePrice) - Number(b.salePrice))
    else if (sort === 'price_high') enriched.sort((a: any, b: any) => Number(b.salePrice) - Number(a.salePrice))

    const encrypted = encrypt(JSON.stringify({ products: enriched }))
    return NextResponse.json({ data: encrypted })
  } catch (error: any) {
    console.error('Category API Error:', error)
    const encrypted = encrypt(JSON.stringify({ error: error.message || 'Failed to fetch products' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}
