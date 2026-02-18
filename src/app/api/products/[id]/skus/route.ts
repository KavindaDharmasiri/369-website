import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/apiMiddleware'

const getHandler = async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { searchParams } = new URL(req.url)
    const variantKeys = searchParams.get('variantKeys')
    
    const where: any = { productId: parseInt(params.id) }
    if (variantKeys) {
      where.variantKeys = variantKeys
    }
    
    const skus = await prisma.productSku.findMany({
      where,
      orderBy: { id: 'asc' },
    })

    return NextResponse.json(skus)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest, context: any) {
  return getHandler(req, context)
}
