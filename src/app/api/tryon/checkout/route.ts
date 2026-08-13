import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'
import { encrypt } from '@/lib/encryption'
import {
  TRYON_PACKAGE_DAILY_LIMIT,
  TRYON_PACKAGE_DAYS,
  TRYON_PACKAGE_PRICE,
  TRYON_COMMISSION_PERCENT,
  ensureTryOnRecord,
} from '@/lib/tryonSpace'

export const runtime = 'nodejs'
export const maxDuration = 60

export const POST = requireAuth(async (request: NextRequest, user: any) => {
  try {
    await ensureTryOnRecord(user.userId)

    const now = new Date()
    const expiresAt = new Date(now.getTime() + TRYON_PACKAGE_DAYS * 24 * 60 * 60 * 1000)
    const commission = Math.round(TRYON_PACKAGE_PRICE * TRYON_COMMISSION_PERCENT * 100) / 100
    const providerCut = Math.round((TRYON_PACKAGE_PRICE - commission) * 100) / 100

    await prisma.$transaction([
      prisma.tryOnPayment.create({
        data: {
          userId: user.userId,
          amount: TRYON_PACKAGE_PRICE,
          commission,
          providerCut,
          status: 'demo_paid',
          transactionId: `demo-${Date.now()}`,
        },
      }),
      prisma.tryOnSpace.update({
        where: { userId: user.userId },
        data: {
          packageStatus: 'active',
          packageExpiresAt: expiresAt,
          packageDailyLimit: TRYON_PACKAGE_DAILY_LIMIT,
          packageUpdatedAt: now,
        },
      }),
    ])

    return NextResponse.json({
      data: encrypt(
        JSON.stringify({
          status: 'active',
          expiresAt: expiresAt.toISOString(),
          dailyLimit: TRYON_PACKAGE_DAILY_LIMIT,
          amount: TRYON_PACKAGE_PRICE,
          commission,
        })
      ),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Checkout failed' }, { status: 500 })
  }
})
