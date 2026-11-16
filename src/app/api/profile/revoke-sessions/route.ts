import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/apiMiddleware'
import { recordAudit } from '@/lib/audit'

async function handler(request: NextRequest, user: any) {
  try {
    let updated: any
    try {
      updated = await (prisma.user.update as any)({
        where: { id: user.userId },
        data: { sessionVersion: { increment: 1 } },
        select: { id: true },
      })
    } catch (error: any) {
      if (error?.code === 'P2022' || /sessionVersion|session_version|Unknown arg|does not exist/i.test(error?.message || '')) {
        return NextResponse.json(
          { error: 'Session revocation is unavailable until session_version migration is applied' },
          { status: 409, headers: { 'Cache-Control': 'private, no-store' } }
        )
      }
      if (error?.code === 'P2025') {
        return NextResponse.json({ error: 'User not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
      }
      throw error
    }

    await recordAudit({
      userId: user.userId,
      userEmail: user.email,
      action: 'PROFILE_REVOKE_SESSIONS',
      entityType: 'user',
      entityId: String(user.userId),
      request,
    })

    return NextResponse.json({ success: true, data: { revoked: true } }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to revoke sessions' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export const POST = requireAuth(handler)
