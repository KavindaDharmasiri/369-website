import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { verifyToken } from '@/lib/auth'
import { ValidationError, readJsonObject } from '@/lib/validation'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request)
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim().slice(0, 64) : ''
    const status = typeof body.status === 'string' ? body.status : ''
    if (!sessionId) throw new ValidationError('sessionId is required')
    if (!['clicked', 'dismissed', 'snoozed', 'converted'].includes(status)) throw new ValidationError('Invalid status')

    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const decoded = token ? await loadActiveUser(verifyToken(token)) : null
    const userId = decoded && Number.isInteger(decoded.userId) ? decoded.userId : null

    const impressionToken = typeof body.impressionToken === 'string' ? body.impressionToken : null
    const id = impressionToken && /^\d+$/.test(impressionToken) ? Number(impressionToken) : null
    const snoozeMinutes = Number.isFinite(Number(body.snoozeMinutes)) ? Math.max(1, Math.min(24 * 60, Number(body.snoozeMinutes))) : 30

    if (id) {
      await prisma.recommendationLog.updateMany({
        where: { id, ...(userId ? { OR: [{ userId }, { sessionId }] } : { sessionId }) },
        data: {
          status,
          snoozedUntil: status === 'snoozed' ? new Date(Date.now() + snoozeMinutes * 60 * 1000) : null,
        },
      }).catch(() => null)
    } else {
      // fallback: mark latest shown for session
      const latest = await prisma.recommendationLog.findFirst({ where: { sessionId, status: 'shown' }, orderBy: { createdAt: 'desc' } }).catch(() => null)
      if (latest) {
        await prisma.recommendationLog.update({
          where: { id: latest.id },
          data: { status, snoozedUntil: status === 'snoozed' ? new Date(Date.now() + snoozeMinutes * 60 * 1000) : null },
        }).catch(() => null)
      }
    }

    return NextResponse.json({ success: true }, { headers: noStore })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore })
    return NextResponse.json({ success: true }, { headers: noStore })
  }
}
