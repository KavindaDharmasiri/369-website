import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'

async function listHandler(request: NextRequest, user: any) {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    return NextResponse.json({ success: true, data: { coupons } })
  } catch (error) {
    console.error('Get coupons error:', error)
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 })
  }
}

async function createHandler(request: NextRequest, user: any) {
  try {
    const body = await request.json()
    const {
      code, description, discountType, discountValue,
      minSubtotal, maxDiscount, validFrom, validUntil,
      isActive, maxUses
    } = body

    if (!code || !discountValue) {
      return NextResponse.json({ error: 'Code and discount value are required' }, { status: 400 })
    }
    if (!['percentage', 'fixed'].includes(discountType || 'percentage')) {
      return NextResponse.json({ error: 'Invalid discount type' }, { status: 400 })
    }

    const normalizedCode = String(code).trim().toUpperCase()

    const existing = await prisma.coupon.findUnique({ where: { code: normalizedCode } })
    if (existing) {
      return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 })
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: normalizedCode,
        description: description || null,
        discountType,
        discountValue: Number(discountValue),
        minSubtotal: minSubtotal !== undefined && minSubtotal !== '' ? Number(minSubtotal) : null,
        maxDiscount: maxDiscount !== undefined && maxDiscount !== '' ? Number(maxDiscount) : null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        isActive: isActive !== undefined ? isActive : true,
        maxUses: maxUses !== undefined && maxUses !== '' ? Number(maxUses) : null
      }
    })

    return NextResponse.json({ success: true, data: { coupon } }, { status: 201 })
  } catch (error) {
    console.error('Create coupon error:', error)
    return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 })
  }
}

export const GET = requireAdmin(listHandler)
export const POST = requireAdmin(createHandler)
