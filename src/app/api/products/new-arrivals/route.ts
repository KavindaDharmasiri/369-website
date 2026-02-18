import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { encrypt } from '@/lib/encryption'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        prodMarket: 'MARKETPLACE',
        showInNewArrivals: true,
        isDeleted: false
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ data: encrypt(JSON.stringify({ products })) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
