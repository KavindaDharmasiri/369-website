import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { encryptData } from '@/lib/encryption'
import { numberValue, readJsonObject, ValidationError } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const privateNoStore = { 'Cache-Control': 'private, no-store' }
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateNoStore })
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: privateNoStore })
    }
    if (decoded.userType !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403, headers: privateNoStore })
    }

    const body = await readJsonObject(request)
    if (typeof body.type !== 'string') throw new ValidationError('Shipping type is required')
    const type = body.type.trim().toLowerCase()
    if (!['standard', 'fixed', 'percentage'].includes(type)) throw new ValidationError('Invalid shipping type')
    const value = numberValue(body.value, 'Shipping value')
    if (value < 0 || value > 99999999.99 || (type === 'percentage' && value > 100)) {
      throw new ValidationError('Invalid shipping value')
    }

    // A failed replacement must roll back deactivation of the existing fee.
    // Cross-request single-active enforcement remains a database constraint task.
    const shippingFee = await prisma.$transaction(async tx => {
      await tx.shippingFee.updateMany({ data: { isActive: false } })
      return tx.shippingFee.create({ data: { type, value, isActive: true } })
    })

    return NextResponse.json({ success: true, data: encryptData(shippingFee) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Shipping fee error', error)
    return NextResponse.json({ error: 'Failed to save shipping fee' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export async function GET(request: NextRequest) {
  try {
    const shippingFee = await prisma.shippingFee.findFirst({
      where: { isActive: true }
    })

    return NextResponse.json({ data: shippingFee ? encryptData(shippingFee) : null })
  } catch (error) {
    logServerError('Get shipping fee error', error)
    return NextResponse.json({ error: 'Failed to get shipping fee' }, { status: 500 })
  }
}
import { logServerError } from '@/lib/serverLog'
