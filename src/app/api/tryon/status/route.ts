import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/apiMiddleware'
import {
  TRYON_PACKAGE_DAILY_LIMIT,
  TRYON_PACKAGE_PRICE,
  ensureTryOnRecord,
  getPackageState,
  todayStr,
} from '@/lib/tryonSpace'

export const runtime = 'nodejs'
export const maxDuration = 60

export const GET = requireAuth(async (request: NextRequest, user: any) => {
  try {
    const record = await ensureTryOnRecord(user.userId)
    const today = todayStr()
    const usedToday = record.usageDate === today ? record.usedToday : 0
    const pkg = getPackageState(record)

    return NextResponse.json({
      status: 'ready',
      remaining: pkg.active ? Math.max(0, pkg.dailyLimit - usedToday) : 0,
      free: !pkg.active,
      preview: !pkg.active,
      freeLimit: 0,
      package: pkg.active
        ? { expiresAt: pkg.expiresAt, dailyLimit: pkg.dailyLimit }
        : null,
      price: TRYON_PACKAGE_PRICE,
      packageDailyLimit: TRYON_PACKAGE_DAILY_LIMIT,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to check try-on status' }, { status: 500 })
  }
})
