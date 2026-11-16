import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'
import { discountData, assertDiscountTarget } from '@/lib/promotions'
import { readJsonObject, ValidationError } from '@/lib/validation'
import { recordAudit } from '@/lib/audit'

async function listHandler(request: NextRequest, user: any) {
  try {
    const discounts = await prisma.discount.findMany({
      include: {
        product: { select: { id: true, prodName: true } },
        category: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true, category: { select: { id: true, name: true } } } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    return NextResponse.json({ success: true, data: { discounts } }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    logServerError('Get discounts error', error)
    return NextResponse.json({ error: 'Failed to fetch discounts' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

async function createHandler(request: NextRequest, user: any) {
  try {
    const data = discountData(await readJsonObject(request))
    await assertDiscountTarget(prisma, data)
    const discount = await prisma.discount.create({ data })
    await recordAudit({ userId: user.userId, userEmail: user.email, action: 'DISCOUNT_CREATE', entityType: 'discount', entityId: discount.id, request, metadata: { name: discount.name, scope: discount.scope } })

    return NextResponse.json({ success: true, data: { discount } }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Create discount error', error)
    return NextResponse.json({ error: 'Failed to create discount' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export const GET = requireAdmin(listHandler)
export const POST = requireAdmin(createHandler)
import { logServerError } from '@/lib/serverLog'
