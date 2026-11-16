import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/apiMiddleware'
import { encryptData } from '@/lib/encryption'

const postHandler = async (req: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { images } = await req.json()
    const productId = parseInt((await params).id)

    await prisma.$transaction([
      prisma.productImage.deleteMany({ where: { productId } }),
      ...(images?.length > 0 ? [prisma.productImage.createMany({
        data: images.map((url: string, index: number) => ({
          productId,
          imageUrl: url,
          isPrimary: index === 0
        }))
      })] : [])
    ])

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update images' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

const getHandler = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const images = await prisma.productImage.findMany({
      where: { productId: parseInt((await params).id) },
      orderBy: { isPrimary: 'desc' },
      select: { id: true, imageUrl: true, isPrimary: true }
    })

    return NextResponse.json({ data: encryptData(images) }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const POST = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => postHandler(r, u, context))(req)
export async function GET(req: NextRequest, context: any) {
  return getHandler(req, context)
}
