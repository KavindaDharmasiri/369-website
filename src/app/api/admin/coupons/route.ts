import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'
import { couponData } from '@/lib/promotions'
import { readJsonObject, ValidationError } from '@/lib/validation'
import { recordAudit } from '@/lib/audit'

async function listHandler(request: NextRequest, user: any) {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    return NextResponse.json({ success: true, data: { coupons } }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    logServerError('Get coupons error', error)
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

async function createHandler(request: NextRequest, user: any) {
  try {
    const data = couponData(await readJsonObject(request))

    const existing = await prisma.coupon.findUnique({ where: { code: data.code } })
    if (existing) {
      return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const coupon = await prisma.coupon.create({ data })
    await recordAudit({ userId: user.userId, userEmail: user.email, action: 'COUPON_CREATE', entityType: 'coupon', entityId: coupon.id, request, metadata: { code: coupon.code } })

    return NextResponse.json({ success: true, data: { coupon } }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    if ((error as any)?.code === 'P2002') return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Create coupon error', error)
    return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export const GET = requireAdmin(listHandler)
export const POST = requireAdmin(createHandler)
import { logServerError } from '@/lib/serverLog'
