import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { encryptData } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded || decoded.userType !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { type, value } = await request.json()

    if (!type || value === undefined || value === null) {
      return NextResponse.json({ error: 'Type and value are required' }, { status: 400 })
    }

    // Deactivate all existing fees
    await prisma.shippingFee.updateMany({
      data: { isActive: false }
    })

    // Create new active fee
    const shippingFee = await prisma.shippingFee.create({
      data: { type, value, isActive: true }
    })

    return NextResponse.json({ success: true, data: encryptData(shippingFee) })
  } catch (error) {
    console.error('Shipping fee error:', error)
    return NextResponse.json({ error: 'Failed to save shipping fee' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const shippingFee = await prisma.shippingFee.findFirst({
      where: { isActive: true }
    })

    return NextResponse.json({ data: shippingFee ? encryptData(shippingFee) : null })
  } catch (error) {
    console.error('Get shipping fee error:', error)
    return NextResponse.json({ error: 'Failed to get shipping fee' }, { status: 500 })
  }
}
