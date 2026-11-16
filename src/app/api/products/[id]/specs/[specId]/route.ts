import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/apiMiddleware'

const putHandler = async (req: NextRequest, user: any, { params }: { params: Promise<{ id: string; specId: string }> }) => {
  try {
    const body = await req.json()

    await prisma.productSpecAttr.deleteMany({ where: { specId: parseInt((await params).specId) } })

    const spec = await prisma.productSpec.update({
      where: { id: parseInt((await params).specId) },
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

    return NextResponse.json(spec, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update spec' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

const deleteHandler = async (req: NextRequest, user: any, { params }: { params: Promise<{ id: string; specId: string }> }) => {
  try {
    await prisma.productSpecAttr.deleteMany({ where: { specId: parseInt((await params).specId) } })
    await prisma.productSpec.delete({ where: { id: parseInt((await params).specId) } })
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete spec' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export const PUT = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => putHandler(r, u, context))(req)
export const DELETE = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => deleteHandler(r, u, context))(req)
