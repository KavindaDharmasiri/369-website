import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/apiMiddleware'
import { encrypt } from '@/lib/encryption'

const publicProfileSelect = {
  id: true, email: true, userType: true, firstName: true, lastName: true,
  phone: true, avatarUrl: true, dateOfBirth: true, createdAt: true,
} as const

const privateNoStore = { 'Cache-Control': 'private, no-store' }

async function getHandler(request: NextRequest, user: any) {
  try {

    const profile = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        ...publicProfileSelect,
        addresses: true,
      },
    })

    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: privateNoStore })

    const [orderCount, totalSpentAgg] = await Promise.all([
      prisma.order.count({ where: { userId: user.userId } }),
      prisma.order.aggregate({ where: { userId: user.userId }, _sum: { total: true } }),
    ])

    const data = encrypt(JSON.stringify({
      profile: { ...profile, orderCount, totalSpent: Number(totalSpentAgg._sum.total || 0) },
    }))
    return NextResponse.json({ data }, { headers: privateNoStore })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500, headers: privateNoStore })
  }
}

async function putHandler(request: NextRequest, user: any) {
  try {

    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400, headers: privateNoStore })
    }
    const optionalText = (value: unknown, name: string, max: number) => {
      if (value === undefined) return undefined
      if (value === null || value === '') return null
      if (typeof value !== 'string' || value.trim().length > max) throw new Error(`${name} must be at most ${max} characters`)
      return value.trim()
    }
    let firstName: string | null | undefined
    let lastName: string | null | undefined
    let phone: string | null | undefined
    let dateOfBirth: Date | null | undefined
    try {
      firstName = optionalText(body.firstName, 'First name', 100)
      lastName = optionalText(body.lastName, 'Last name', 100)
      phone = optionalText(body.phone, 'Phone', 100)
      if (body.dateOfBirth === undefined) dateOfBirth = undefined
      else if (body.dateOfBirth === null || body.dateOfBirth === '') dateOfBirth = null
      else if (typeof body.dateOfBirth !== 'string' || Number.isNaN(new Date(body.dateOfBirth).getTime())) {
        throw new Error('Invalid date of birth')
      } else dateOfBirth = new Date(body.dateOfBirth)
    } catch (validationError) {
      return NextResponse.json({ error: validationError instanceof Error ? validationError.message : 'Invalid profile data' }, { status: 400, headers: privateNoStore })
    }

    const profile = await prisma.user.update({
      where: { id: user.userId },
      select: publicProfileSelect,
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(dateOfBirth !== undefined ? { dateOfBirth } : {}),
      },
    })

    const data = encrypt(JSON.stringify({ message: 'Profile updated successfully', profile }))
    return NextResponse.json({ data }, { headers: privateNoStore })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500, headers: privateNoStore })
  }
}

export const GET = requireAuth(getHandler)
export const PUT = requireAuth(putHandler)
