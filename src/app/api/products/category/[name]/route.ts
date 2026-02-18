import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { encrypt } from '@/lib/encryption'

const prisma = new PrismaClient()

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params
    const categoryName = decodeURIComponent(name)
    const { searchParams } = new URL(req.url)
    const sort = searchParams.get('sort') || 'newest'

    let orderBy: any = { createdAt: 'desc' }
    if (sort === 'oldest') orderBy = { createdAt: 'asc' }
    else if (sort === 'price_low') orderBy = { prodPrice: 'asc' }
    else if (sort === 'price_high') orderBy = { prodPrice: 'desc' }
    
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        prodMarket: 'MARKETPLACE',
        prodCategoryName: categoryName
      },
      orderBy
    })

    const encrypted = encrypt(JSON.stringify({ products }))
    return NextResponse.json({ data: encrypted })
  } catch (error: any) {
    console.error('Category API Error:', error)
    const encrypted = encrypt(JSON.stringify({ error: error.message || 'Failed to fetch products' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}
