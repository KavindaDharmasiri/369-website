import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = verifyToken(token)
    if (!user || user.userType !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const unreadOnly = searchParams.get('unread') === 'true'

    const notifications = await prisma.notification.findMany({
      where: { recipient: 'admin', ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    const unreadCount = await prisma.notification.count({
      where: { recipient: 'admin', isRead: false },
    })

    return NextResponse.json({ success: true, data: { notifications, unreadCount } })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = verifyToken(token)
    if (!user || user.userType !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { ids } = body

    if (ids && Array.isArray(ids) && ids.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: ids } },
        data: { isRead: true },
      })
    } else {
      await prisma.notification.updateMany({
        where: { recipient: 'admin', isRead: false },
        data: { isRead: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}
