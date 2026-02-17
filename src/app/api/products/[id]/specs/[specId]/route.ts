import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireAdmin } from '@/lib/apiMiddleware'

const prisma = new PrismaClient()

const putHandler = async (req: NextRequest, user: any, { params }: { params: { id: string; specId: string } }) => {
  try {
    const body = await req.json()

    await prisma.productSpecAttr.deleteMany({ where: { specId: parseInt(params.specId) } })

    const spec = await prisma.productSpec.update({
      where: { id: parseInt(params.specId) },
      data: {
        name: body.name,
        description: body.description,
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

    return NextResponse.json(spec)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

const deleteHandler = async (req: NextRequest, user: any, { params }: { params: { id: string; specId: string } }) => {
  try {
    await prisma.productSpecAttr.deleteMany({ where: { specId: parseInt(params.specId) } })
    await prisma.productSpec.delete({ where: { id: parseInt(params.specId) } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const PUT = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => putHandler(r, u, context))(req)
export const DELETE = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => deleteHandler(r, u, context))(req)
