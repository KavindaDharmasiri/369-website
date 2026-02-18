import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { encrypt } from '@/lib/encryption'

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        prodMarket: 'MARKETPLACE',
        featuredOnHomepage: true,
        isDeleted: false
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ data: encrypt(JSON.stringify({ products })) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
