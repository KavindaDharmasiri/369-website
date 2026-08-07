import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { encrypt } from '@/lib/encryption'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = verifyToken(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
        userType: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        dateOfBirth: true,
        createdAt: true,
        addresses: true,
      },
    })

    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const [orderCount, totalSpentAgg] = await Promise.all([
      prisma.order.count({ where: { userId: user.userId } }),
      prisma.order.aggregate({ where: { userId: user.userId }, _sum: { total: true } }),
    ])

    const data = encrypt(JSON.stringify({
      profile: { ...profile, orderCount, totalSpent: Number(totalSpentAgg._sum.total || 0) },
    }))
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = verifyToken(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { firstName, lastName, phone, dateOfBirth } = body

    const profile = await prisma.user.update({
      where: { id: user.userId },
      data: {
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
        phone: phone ?? undefined,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      },
    })

    const data = encrypt(JSON.stringify({ message: 'Profile updated successfully', profile }))
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
