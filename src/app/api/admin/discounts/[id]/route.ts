import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'
import { discountData, assertDiscountTarget } from '@/lib/promotions'
import { positiveId, readJsonObject, ValidationError } from '@/lib/validation'
import { recordAudit } from '@/lib/audit'

async function updateHandler(request: NextRequest, user: any, context: any) {
  try {
    const id = positiveId((await context.params).id)
    const body = await readJsonObject(request)

    const existing = await prisma.discount.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const data = discountData(body, existing)
    await assertDiscountTarget(prisma, data)
    const discount = await prisma.discount.update({
      where: { id },
      data
    })
    await recordAudit({ userId: user.userId, userEmail: user.email, action: 'DISCOUNT_UPDATE', entityType: 'discount', entityId: discount.id, request, metadata: { name: discount.name, scope: discount.scope } })

    return NextResponse.json({ success: true, data: { discount } }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Update discount error', error)
    return NextResponse.json({ error: 'Failed to update discount' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

async function deleteHandler(request: NextRequest, user: any, context: any) {
  try {
    const id = positiveId((await context.params).id)

    const existing = await prisma.discount.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    }

    await prisma.discount.delete({ where: { id } })
    await recordAudit({ userId: user.userId, userEmail: user.email, action: 'DISCOUNT_DELETE', entityType: 'discount', entityId: id, request })

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Delete discount error', error)
    return NextResponse.json({ error: 'Failed to delete discount' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export const PATCH = requireAdmin(updateHandler)
export const DELETE = requireAdmin(deleteHandler)
import { logServerError } from '@/lib/serverLog'
