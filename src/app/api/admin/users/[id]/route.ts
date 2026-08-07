import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'

async function handler(request: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = parseInt(id)

    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        userType: true,
        isActive: true,
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

    const [orders, audit] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        include: { orderItems: { select: { productName: true, quantity: true, price: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.auditTrail.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    const totalSpentAgg = await prisma.order.aggregate({
      where: { userId },
      _sum: { total: true },
      _count: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          ...profile,
          orders,
          audit: audit,
          auditTrail: audit,
          totalSpent: Number(totalSpentAgg._sum.total || 0),
          orderCount: totalSpentAgg._count,
        },
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export const GET = requireAdmin(handler)
