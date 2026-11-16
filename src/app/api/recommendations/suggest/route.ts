import { NextRequest, NextResponse } from 'next/server'
import { generateSuggestion } from '@/lib/recommendations/engine'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { verifyToken } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { ValidationError, readJsonObject } from '@/lib/validation'

const noStore = { 'Cache-Control': 'private, no-store' }

function positiveInt(v: unknown): number | null {
  if (Number.isInteger(v) && (v as number) > 0 && (v as number) <= 2147483647) return v as number
  if (typeof v === 'string' && /^[1-9]\d{0,9}$/.test(v) && Number(v) <= 2147483647) return Number(v)
  return null
}

function idList(v: unknown, max = 30): number[] {
  return Array.isArray(v) ? v.map(positiveInt).filter((n): n is number => n !== null).slice(0, max) : []
}

function shortText(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request)
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim().slice(0, 64) : ''
    if (!sessionId) throw new ValidationError('sessionId is required')

    const limit = checkRateLimit(`suggest:${sessionId}`, 40, 60_000)
    if (!limit.allowed) return NextResponse.json({ success: true, data: { enabled: false } }, { headers: noStore })

    // An expired or revoked token simply means "guest" — guests still get suggestions.
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const decoded = token ? await loadActiveUser(verifyToken(token)) : null
    const userId = decoded && Number.isInteger(decoded.userId) ? decoded.userId : null

    const result = await generateSuggestion({
      sessionId,
      userId,
      pageType: typeof body.pageType === 'string' ? body.pageType.slice(0, 64) : 'other',
      pagePath: typeof body.pagePath === 'string' ? body.pagePath.slice(0, 500) : undefined,
      productId: positiveInt(body.productId),
      productRef: shortText(body.productRef, 200),
      categoryId: positiveInt(body.categoryId),
      categoryRef: shortText(body.categoryRef, 120),
      searchQuery: shortText(body.searchQuery, 200),
      cartCount: Number.isFinite(Number(body.cartCount)) ? Math.max(0, Math.min(1000, Math.trunc(Number(body.cartCount)))) : 0,
      cartProductIds: idList(body.cartProductIds, 50),
      viewedProductIds: idList(body.viewedProductIds),
      recentProductIds: idList(body.recentProductIds),
      excludeProductIds: idList(body.excludeProductIds, 40),
      productViewCount: Number.isFinite(Number(body.productViewCount)) ? Math.max(0, Math.min(100, Math.trunc(Number(body.productViewCount)))) : 0,
      activeMs: Number.isFinite(Number(body.activeMs)) ? Math.max(0, Math.min(60 * 60 * 1000, Number(body.activeMs))) : 0,
      scrollDepth: Number.isFinite(Number(body.scrollDepth)) ? Math.max(0, Math.min(100, Number(body.scrollDepth))) : 0,
      unavailableSelection: body.unavailableSelection === true,
    })

    if (!result.enabled) {
      return NextResponse.json({ success: true, data: { enabled: false } }, { headers: noStore })
    }
    return NextResponse.json({ success: true, data: result }, { headers: noStore })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore })
    return NextResponse.json({ success: true, data: { enabled: false } }, { headers: noStore })
  }
}
