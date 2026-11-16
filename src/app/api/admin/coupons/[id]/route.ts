import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'
import { couponData } from '@/lib/promotions'
import { positiveId, readJsonObject, ValidationError } from '@/lib/validation'
import { recordAudit } from '@/lib/audit'

async function updateHandler(request: NextRequest, user: any, context: any) {
  try {
    const id = positiveId((await context.params).id)
    const body = await readJsonObject(request)

    const existing = await prisma.coupon.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const data = couponData(body, existing)

    if (data.code !== existing.code) {
      const dup = await prisma.coupon.findUnique({ where: { code: data.code } })
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } })
      }
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data
    })
    await recordAudit({ userId: user.userId, userEmail: user.email, action: 'COUPON_UPDATE', entityType: 'coupon', entityId: coupon.id, request, metadata: { code: coupon.code } })

    return NextResponse.json({ success: true, data: { coupon } }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    if ((error as any)?.code === 'P2002') return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Update coupon error', error)
    return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

async function deleteHandler(request: NextRequest, user: any, context: any) {
  try {
    const id = positiveId((await context.params).id)

    const existing = await prisma.coupon.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    }

    await prisma.coupon.delete({ where: { id } })
    await recordAudit({ userId: user.userId, userEmail: user.email, action: 'COUPON_DELETE', entityType: 'coupon', entityId: id, request })

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Delete coupon error', error)
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export const PATCH = requireAdmin(updateHandler)
export const DELETE = requireAdmin(deleteHandler)
import { logServerError } from '@/lib/serverLog'
