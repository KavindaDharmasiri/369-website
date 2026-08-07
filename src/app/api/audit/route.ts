import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = verifyToken(token)
    if (!user || user.userType !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const action = searchParams.get('action') || ''
    const search = searchParams.get('search') || ''

    const where: any = {}
    if (action) where.action = action
    if (search) where.userEmail = { contains: search, mode: 'insensitive' }

    const records = await prisma.auditTrail.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ success: true, data: { records } })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch audit records' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ success: true })
    }

    const user = verifyToken(token)
    if (!user || user.userType !== 'customer') {
      return NextResponse.json({ success: true })
    }

    const body = await req.json()
    const { action, entityType, entityId, metadata } = body

    await prisma.auditTrail.create({
      data: {
        userId: user.userId,
        userEmail: user.email,
        action,
        entityType,
        entityId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}
