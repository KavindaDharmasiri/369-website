import { NextRequest, NextResponse } from 'next/server'
import { getAppSettings, setAppSetting } from '@/lib/settings'
import { encrypt } from '@/lib/encryption'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'
import { numberValue, readJsonObject, ValidationError } from '@/lib/validation'
import { recordAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const settings = await getAppSettings()
    return NextResponse.json(
      { data: encrypt(JSON.stringify(settings)) },
      { headers: { 'Cache-Control': 'public, s-maxage=60, max-age=60' } }
    )
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const privateNoStore = { 'Cache-Control': 'private, no-store' }
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateNoStore })

    const user = await loadActiveUser(verifyToken(token))
    if (!user || !Number.isInteger(user.userId) || user.userId < 1) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: privateNoStore })
    if (user.userType !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403, headers: privateNoStore })
    }

    const body = await readJsonObject(request)
    const { taxMode, taxRate, lowStockThreshold } = body

    if (taxMode !== undefined && !['percentage', 'fixed'].includes(taxMode)) {
      return NextResponse.json({ error: 'Invalid tax mode' }, { status: 400 })
    }

    // Collect data only: no write promises may start until all values are valid.
    const updates: { key: string; value: string; description: string }[] = []
    if (taxMode !== undefined) updates.push({ key: 'taxMode', value: taxMode, description: 'How tax is applied: percentage or fixed' })
    if (taxRate !== undefined) {
      const rate = numberValue(taxRate, 'Tax rate')
      if (rate < 0 || rate > 99999999.99) return NextResponse.json({ error: 'Invalid tax rate' }, { status: 400 })
      updates.push({ key: 'taxRate', value: String(rate), description: 'Tax rate percentage or fixed amount' })
    }
    if (lowStockThreshold !== undefined) {
      const threshold = numberValue(lowStockThreshold, 'Low stock threshold')
      if (!Number.isInteger(threshold) || threshold < 0 || threshold > 2147483647) return NextResponse.json({ error: 'Invalid low stock threshold' }, { status: 400 })
      updates.push({ key: 'lowStockThreshold', value: String(threshold), description: 'Stock level that triggers a low stock alert' })
    }

    await prisma.$transaction(updates.map(({ key, value, description }) => setAppSetting(key, value, description)))
    await recordAudit({
      userId: user.userId,
      userEmail: user.email,
      action: 'SETTINGS_UPDATE',
      entityType: 'settings',
      metadata: { keys: updates.map((u) => u.key) },
      request,
    })

    const settings = await getAppSettings()
    return NextResponse.json({ success: true, data: encrypt(JSON.stringify(settings)) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
