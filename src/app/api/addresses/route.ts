import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'

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
    const { firstName, lastName, address, apartment, city, state, zipCode, phone } = await request.json()

    // Check if user already has an address
    const existingAddress = await prisma.address.findFirst({
      where: { userId: decoded.userId }
    })

    let savedAddress
    if (existingAddress) {
      // Update existing address
      savedAddress = await prisma.address.update({
        where: { address_id: existingAddress.address_id },
        data: {
          firstName,
          lastName,
          address,
          apartment,
          city,
          state,
          zipCode,
          phone
        }
      })
    } else {
      // Create new address
      savedAddress = await prisma.address.create({
        data: {
          userId: decoded.userId,
          firstName,
          lastName,
          address,
          apartment,
          city,
          state,
          zipCode,
          phone
        }
      })
    }

    return NextResponse.json({ success: true, data: savedAddress }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    logServerError('Save address error', error)
    return NextResponse.json({ error: 'Failed to save address' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const addresses = await prisma.address.findMany({
      where: { userId: decoded.userId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ success: true, data: addresses }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    logServerError('Get addresses error', error)
    return NextResponse.json({ error: 'Failed to get addresses' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
import { logServerError } from '@/lib/serverLog'
