import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'

async function updateHandler(request: NextRequest, user: any, context: any) {
  try {
    const id = parseInt(context.params.id)
    const body = await request.json()
    const {
      code, description, discountType, discountValue,
      minSubtotal, maxDiscount, validFrom, validUntil,
      isActive, maxUses
    } = body

    const existing = await prisma.coupon.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    }

    const normalizedCode = code !== undefined ? String(code).trim().toUpperCase() : undefined

    if (normalizedCode) {
      const dup = await prisma.coupon.findUnique({ where: { code: normalizedCode } })
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 })
      }
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        code: normalizedCode,
        description: description !== undefined ? description || null : undefined,
        discountType: discountType || undefined,
        discountValue: discountValue !== undefined ? Number(discountValue) : undefined,
        minSubtotal: minSubtotal !== undefined ? (minSubtotal === '' || minSubtotal === null ? null : Number(minSubtotal)) : undefined,
        maxDiscount: maxDiscount !== undefined ? (maxDiscount === '' || maxDiscount === null ? null : Number(maxDiscount)) : undefined,
        validFrom: validFrom !== undefined ? (validFrom ? new Date(validFrom) : null) : undefined,
        validUntil: validUntil !== undefined ? (validUntil ? new Date(validUntil) : null) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        maxUses: maxUses !== undefined ? (maxUses === '' || maxUses === null ? null : Number(maxUses)) : undefined
      }
    })

    return NextResponse.json({ success: true, data: { coupon } })
  } catch (error) {
    console.error('Update coupon error:', error)
    return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 })
  }
}

async function deleteHandler(request: NextRequest, user: any, context: any) {
  try {
    const id = parseInt(context.params.id)

    const existing = await prisma.coupon.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    }

    await prisma.coupon.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete coupon error:', error)
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 })
  }
}

export const PATCH = requireAdmin(updateHandler)
export const DELETE = requireAdmin(deleteHandler)
