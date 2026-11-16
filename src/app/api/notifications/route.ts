import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { positiveId, readJsonObject, ValidationError } from '@/lib/validation'

const privateNoStore = { 'Cache-Control': 'private, no-store' }

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateNoStore })

    const user = await loadActiveUser(verifyToken(token))
    if (!user || !Number.isInteger(user.userId) || user.userId < 1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: privateNoStore })
    }
    if (user.userType !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403, headers: privateNoStore })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(positiveId(searchParams.get('limit') ?? '20', 'Limit'), 50)
    const unreadOnly = searchParams.get('unread') === 'true'

    const notifications = await prisma.notification.findMany({
      where: { recipient: 'admin', ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    const unreadCount = await prisma.notification.count({
      where: { recipient: 'admin', isRead: false },
    })

    return NextResponse.json({ success: true, data: { notifications, unreadCount } }, { headers: privateNoStore })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: privateNoStore })
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500, headers: privateNoStore })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateNoStore })

    const user = await loadActiveUser(verifyToken(token))
    if (!user || !Number.isInteger(user.userId) || user.userId < 1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: privateNoStore })
    }
    if (user.userType !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403, headers: privateNoStore })
    }

    const body = await readJsonObject(request)
    const { ids } = body
    if (ids !== undefined) {
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) throw new ValidationError('ids must contain 1 to 100 notification IDs')
      const validatedIds = ids.map(id => positiveId(id, 'Notification ID'))
      await prisma.notification.updateMany({
        where: { recipient: 'admin', id: { in: validatedIds } },
        data: { isRead: true },
      })
    } else {
      await prisma.notification.updateMany({
        where: { recipient: 'admin', isRead: false },
        data: { isRead: true },
      })
    }

    return NextResponse.json({ success: true }, { headers: privateNoStore })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: privateNoStore })
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500, headers: privateNoStore })
  }
}
