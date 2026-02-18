import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireAdmin } from '@/lib/apiMiddleware'

const prisma = new PrismaClient()

const putHandler = async (req: NextRequest, user: any, { params }: { params: { id: string, skuId: string } }) => {
  try {
    const { description, price, images } = await req.json()
    
    const updatedSku = await prisma.productSku.update({
      where: { id: parseInt(params.skuId) },
      data: {
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(images !== undefined && { images }),
      },
    })

    return NextResponse.json(updatedSku)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const PUT = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => putHandler(r, u, context))(req)