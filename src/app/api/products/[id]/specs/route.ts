import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/apiMiddleware'
import { encrypt } from '@/lib/encryption'

const getHandler = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const specs = await prisma.productSpec.findMany({
      where: { productId: parseInt((await params).id) },
      include: { attributes: true },
      orderBy: { orderNo: 'asc' },
    })

    return NextResponse.json({ data: encrypt(JSON.stringify(specs)) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

const postHandler = async (req: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const body = await req.json()
    const productId = parseInt((await params).id)

    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
    }

    const spec = await prisma.productSpec.create({
      data: {
        productId,
        name: body.name,
        description: body.description,
        orderNo: await prisma.productSpec.count({ where: { productId } }) + 1,
        attributes: {
          create: body.attributes.map((attr: any) => ({
            name: attr.name,
            value: attr.value,
            type: attr.type || 'text',
          })),
        },
      },
      include: { attributes: true },
    })

    return NextResponse.json(spec, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create spec' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export async function GET(req: NextRequest, context: any) {
  return getHandler(req, context)
}
export const POST = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => postHandler(r, u, context))(req)
