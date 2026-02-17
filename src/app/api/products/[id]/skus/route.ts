import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireAdmin } from '@/lib/apiMiddleware'

const prisma = new PrismaClient()

const getHandler = async (req: NextRequest, user: any, { params }: { params: { id: string } }) => {
  try {
    const skus = await prisma.productSku.findMany({
      where: { productId: parseInt(params.id) },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json(skus)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const GET = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => getHandler(r, u, context))(req)
