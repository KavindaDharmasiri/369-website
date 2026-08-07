import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'

async function handler(request: NextRequest, user: any) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0') || 0

    const where: any = {}
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          userType: true,
          isActive: true,
          firstName: true,
          lastName: true,
          phone: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ])

    const ids = users.map((u) => u.id)
    const spends = ids.length
      ? await prisma.order.groupBy({
          by: ['userId'],
          where: { userId: { in: ids } },
          _sum: { total: true },
        })
      : []

    const spendMap = new Map(spends.map((s) => [s.userId, Number(s._sum.total || 0)]))

    const enriched = users.map((u) => ({
      ...u,
      totalSpent: spendMap.get(u.id) || 0,
    }))

    return NextResponse.json({ success: true, data: { users: enriched, total } })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export const GET = requireAdmin(handler)
