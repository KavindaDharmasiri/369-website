import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/apiMiddleware'

const putHandler = async (req: NextRequest, user: any, { params }: { params: { id: string, skuId: string } }) => {
  try {
    const { description, price, stock, images } = await req.json()
    
    const updatedSku = await prisma.productSku.update({
      where: { id: parseInt(params.skuId) },
      data: {
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(stock !== undefined && { stock: parseInt(stock) }),
        ...(images !== undefined && { images }),
      },
    })

    return NextResponse.json(updatedSku)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const PUT = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => putHandler(r, u, context))(req)