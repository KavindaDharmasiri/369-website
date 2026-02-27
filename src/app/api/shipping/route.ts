import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '@/lib/auth'
import { encryptData } from '@/lib/encryption'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    verifyToken(token)
    const { type, value } = await request.json()

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

    return NextResponse.json({ data: encryptData(shippingFee) })
  } catch (error) {
    console.error('Get shipping fee error:', error)
    return NextResponse.json({ error: 'Failed to get shipping fee' }, { status: 500 })
  }
}
