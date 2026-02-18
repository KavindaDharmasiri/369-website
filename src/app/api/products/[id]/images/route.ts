import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireAdmin } from '@/lib/apiMiddleware'

const prisma = new PrismaClient()

const postHandler = async (req: NextRequest, user: any, { params }: { params: { id: string } }) => {
  try {
    const { images } = await req.json()
    const productId = parseInt(params.id)

    // Delete existing images
    await prisma.productImage.deleteMany({ where: { productId } })

    // Create new images
    if (images && images.length > 0) {
      await prisma.productImage.createMany({
        data: images.map((url: string, index: number) => ({
          productId,
          imageUrl: url,
          isPrimary: index === 0
        }))
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

const getHandler = async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const images = await prisma.productImage.findMany({
      where: { productId: parseInt(params.id) },
      orderBy: { isPrimary: 'desc' }
    })

    return NextResponse.json({ images })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const POST = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => postHandler(r, u, context))(req)
export async function GET(req: NextRequest, context: any) {
  return getHandler(req, context)
}
