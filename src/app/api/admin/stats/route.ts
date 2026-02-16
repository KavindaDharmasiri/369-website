import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'

async function handler(request: NextRequest, user: any) {
  try {
    const stats = {
      totalUsers: await prisma.user.count(),
      totalOrders: await prisma.order.count(),
      totalRevenue: 124563,
      conversionRate: 3.24
    }

    return NextResponse.json(stats)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

export const GET = requireAdmin(handler)
