import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { encrypt } from '@/lib/encryption'
import { attachDiscountInfo } from '@/lib/discounts'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        prodMarket: 'MARKETPLACE',
        featuredOnHomepage: true,
        isDeleted: false
      },
      include: { productImages: { orderBy: { isPrimary: 'desc' }, take: 5 } },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const enriched = await attachDiscountInfo(prisma, products)

    return NextResponse.json(
      { data: encrypt(JSON.stringify({ products: enriched })) },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
