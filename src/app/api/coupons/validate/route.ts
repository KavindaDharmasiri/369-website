import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { encryptData } from '@/lib/encryption'
import { validateCoupon } from '@/lib/coupons'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    const { code, subtotal } = await request.json()

    if (!code) {
      return NextResponse.json({ data: encryptData({ valid: false, message: 'Enter a coupon code' }) })
    }

    const subtotalNum = Number(subtotal) || 0
    const result = await validateCoupon(prisma, code, subtotalNum)

    if (!result.valid) {
      return NextResponse.json({ data: encryptData({ valid: false, message: result.message }) })
    }

    return NextResponse.json({
      data: encryptData({
        valid: true,
        code: result.coupon.code,
        discountType: result.discountType,
        discount: result.discount,
        description: result.coupon.description
      })
    })
  } catch (error) {
    console.error('Validate coupon error:', error)
    return NextResponse.json({ data: encryptData({ valid: false, message: 'Failed to validate coupon' }) }, { status: 500 })
  }
}
