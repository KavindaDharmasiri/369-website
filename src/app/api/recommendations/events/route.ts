import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { verifyToken } from '@/lib/auth'
import { ValidationError, readJsonObject } from '@/lib/validation'

const noStore = { 'Cache-Control': 'private, no-store' }
const MAX_EVENTS = 25

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request)
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim().slice(0, 64) : ''
    if (!sessionId) throw new ValidationError('sessionId is required')
    const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : []
    if (!events.length) return NextResponse.json({ success: true }, { headers: noStore })

    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const decoded = token ? await loadActiveUser(verifyToken(token)) : null
    const userId = decoded && Number.isInteger(decoded.userId) ? decoded.userId : null

    // Respect opt-out for authenticated users
    if (userId) {
      const pref = await prisma.userPreference.findUnique({ where: { userId } }).catch(() => null)
      if (pref && pref.personalizationEnabled === false) {
        return NextResponse.json({ success: true, data: { accepted: 0 } }, { headers: noStore })
      }
    }

    const rows = events.map((ev: any) => {
      const eventType = typeof ev?.eventType === 'string' ? ev.eventType.slice(0, 64) : ''
      if (!eventType) return null
      return {
        sessionId,
        userId,
        eventType,
        pagePath: typeof ev?.pagePath === 'string' ? ev.pagePath.slice(0, 500) : null,
        pageType: typeof ev?.pageType === 'string' ? ev.pageType.slice(0, 64) : null,
        productId: Number.isInteger(ev?.productId) ? ev.productId : null,
        categoryId: Number.isInteger(ev?.categoryId) ? ev.categoryId : null,
        searchQuery: typeof ev?.searchQuery === 'string' ? ev.searchQuery.slice(0, 200) : null,
        activeMs: Number.isFinite(Number(ev?.activeMs)) ? Math.max(0, Math.min(30 * 60 * 1000, Math.trunc(Number(ev.activeMs)))) : 0,
        scrollDepth: Number.isFinite(Number(ev?.scrollDepth)) ? Math.max(0, Math.min(100, Math.trunc(Number(ev.scrollDepth)))) : null,
        // Prisma rejects a plain `null` for Json columns (it needs Prisma.JsonNull), which
        // made the whole batch fail silently. Omit the field instead -> stored as NULL.
        ...(ev?.metadata && typeof ev.metadata === 'object' && !Array.isArray(ev.metadata) ? { metadata: ev.metadata } : {}),
      }
    }).filter(Boolean) as any[]

    if (rows.length) {
      await prisma.engagementEvent.createMany({ data: rows }).catch(() => null)
    }
    return NextResponse.json({ success: true, data: { accepted: rows.length } }, { headers: noStore })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore })
    return NextResponse.json({ success: true, data: { accepted: 0 } }, { headers: noStore })
  }
}
