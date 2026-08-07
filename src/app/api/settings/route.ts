import { NextRequest, NextResponse } from 'next/server'
import { getAppSettings, setAppSetting } from '@/lib/settings'
import { encrypt } from '@/lib/encryption'
import { verifyToken } from '@/lib/auth'

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
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = verifyToken(token)
    if (!user || user.userType !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { taxMode, taxRate, lowStockThreshold } = body

    if (taxMode && !['percentage', 'fixed'].includes(taxMode)) {
      return NextResponse.json({ error: 'Invalid tax mode' }, { status: 400 })
    }

    const updates = []
    if (taxMode) updates.push(setAppSetting('taxMode', taxMode, 'How tax is applied: percentage or fixed'))
    if (taxRate !== undefined) {
      const rate = parseFloat(taxRate)
      if (isNaN(rate) || rate < 0) return NextResponse.json({ error: 'Invalid tax rate' }, { status: 400 })
      updates.push(setAppSetting('taxRate', String(rate), 'Tax rate percentage or fixed amount'))
    }
    if (lowStockThreshold !== undefined) {
      const threshold = parseInt(lowStockThreshold)
      if (isNaN(threshold) || threshold < 0) return NextResponse.json({ error: 'Invalid low stock threshold' }, { status: 400 })
      updates.push(setAppSetting('lowStockThreshold', String(threshold), 'Stock level that triggers a low stock alert'))
    }

    await Promise.all(updates)

    const settings = await getAppSettings()
    return NextResponse.json({ success: true, data: encrypt(JSON.stringify(settings)) })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
