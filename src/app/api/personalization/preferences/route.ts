import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/apiMiddleware'
import { ValidationError, readJsonObject } from '@/lib/validation'

const noStore = { 'Cache-Control': 'private, no-store' }

export const GET = requireAuth(async (_req: NextRequest, user: any) => {
  const pref = await prisma.userPreference.findUnique({ where: { userId: user.userId } }).catch(() => null)
  return NextResponse.json({ success: true, data: { personalizationEnabled: pref ? pref.personalizationEnabled : true, preference: pref } }, { headers: noStore })
})

export const PUT = requireAuth(async (req: NextRequest, user: any) => {
  try {
    const body = await readJsonObject(req)
    const enabled = body.personalizationEnabled
    if (typeof enabled !== 'boolean') throw new ValidationError('personalizationEnabled must be boolean')
    const data = {
      personalizationEnabled: enabled,
      consentUpdatedAt: new Date(),
      preferredSizes: Array.isArray(body.preferredSizes) ? JSON.stringify(body.preferredSizes.slice(0, 20)) : (typeof body.preferredSizes === 'string' ? body.preferredSizes.slice(0, 500) : undefined),
      preferredColors: Array.isArray(body.preferredColors) ? JSON.stringify(body.preferredColors.slice(0, 20)) : (typeof body.preferredColors === 'string' ? body.preferredColors.slice(0, 500) : undefined),
      favoriteCategories: Array.isArray(body.favoriteCategories) ? JSON.stringify(body.favoriteCategories.slice(0, 20)) : (typeof body.favoriteCategories === 'string' ? body.favoriteCategories.slice(0, 500) : undefined),
      preferredStyles: Array.isArray(body.preferredStyles) ? JSON.stringify(body.preferredStyles.slice(0, 20)) : (typeof body.preferredStyles === 'string' ? body.preferredStyles.slice(0, 500) : undefined),
    }
    const pref = await prisma.userPreference.upsert({
      where: { userId: user.userId },
      update: data as any,
      create: { userId: user.userId, ...data } as any,
    })
    return NextResponse.json({ success: true, data: { personalizationEnabled: pref.personalizationEnabled } }, { headers: noStore })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore })
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500, headers: noStore })
  }
})
