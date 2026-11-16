import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { encryptData } from '@/lib/encryption'
import { validateCoupon } from '@/lib/coupons'
import { readJsonObject, textValue, ValidationError } from '@/lib/validation'
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const rl = checkRateLimit(`coupon-validate:${decoded.userId}:${getClientIp(request)}`, 30, 10 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ data: encryptData({ valid: false, message: 'Too many requests. Please try again later.' }) }, { status: 429, headers: rateLimitHeaders(rl) })
    }
    const { code, subtotal } = await readJsonObject(request)

    if (!code) {
      return NextResponse.json({ data: encryptData({ valid: false, message: 'Enter a coupon code' }) }, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    if (typeof subtotal !== 'number' || !Number.isFinite(subtotal) || subtotal < 0 || subtotal > 99999999.99) {
      throw new ValidationError('Subtotal must be a finite nonnegative amount')
    }
    const result = await validateCoupon(prisma, textValue(code, 'Coupon code', 64), subtotal)

    if (!result.valid) {
      return NextResponse.json({ data: encryptData({ valid: false, message: result.message }) }, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    return NextResponse.json({
      data: encryptData({
        valid: true,
        code: result.coupon.code,
        discountType: result.discountType,
        discount: result.discount,
        description: result.coupon.description
      })
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Validate coupon error', error)
    return NextResponse.json({ data: encryptData({ valid: false, message: 'Failed to validate coupon' }) }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
import { logServerError } from '@/lib/serverLog'
