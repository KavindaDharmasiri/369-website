import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { positiveId, readJsonObject, ValidationError } from '@/lib/validation'

async function handler(request: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }) {
  try {
    const targetUserId = positiveId((await params).id, 'User id')
    const body = await readJsonObject(request)

    const data: any = {}
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        throw new ValidationError('isActive must be a boolean')
      }
      if (body.isActive === false && targetUserId === user.userId) {
        return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
      }
      data.isActive = body.isActive
    }

    if (body.revokeSessions !== undefined && typeof body.revokeSessions !== 'boolean') {
      throw new ValidationError('revokeSessions must be a boolean')
    }
    const revokeSessions = body.revokeSessions === true
    if (!('isActive' in data) && !revokeSessions) {
      return NextResponse.json({ error: 'No valid changes provided' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }

    let updated: any
    try {
      if (revokeSessions) {
        updated = await (prisma.user.update as any)({
          where: { id: targetUserId },
          data: {
            ...data,
            sessionVersion: { increment: 1 },
          },
          select: { id: true, email: true, userType: true, isActive: true, sessionVersion: true, createdAt: true },
        })
      } else {
        updated = await prisma.user.update({
          where: { id: targetUserId },
          data,
          select: { id: true, email: true, userType: true, isActive: true, createdAt: true },
        })
      }
    } catch (error: any) {
      if (revokeSessions && (error?.code === 'P2022' || /sessionVersion|session_version|Unknown arg|does not exist/i.test(error?.message || ''))) {
        // Never apply only half the requested security change or audit a false revocation.
        return NextResponse.json({ error: 'Session revocation is unavailable until session_version migration is applied' }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } })
      } else {
        throw error
      }
    }

    await recordAudit({
      userId: user.userId,
      userEmail: user.email,
      action: revokeSessions ? 'USER_REVOKE_SESSIONS' : 'USER_UPDATE',
      entityType: 'user',
      entityId: String(targetUserId),
      request,
      metadata: { isActive: data.isActive, revokeSessions },
    })

    return NextResponse.json({ success: true, data: { user: updated } }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    }
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    }
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export const PATCH = requireAdmin((req: NextRequest, user: any, context: any) => handler(req, user, context))
