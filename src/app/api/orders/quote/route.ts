import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/apiMiddleware'
import { canonicalOrderInput } from '@/lib/orderRequestInput'
import { fingerprintOrderInput } from '@/lib/orderRequests'
import { calculateCheckout } from '@/lib/checkoutCalculation'
import { issueQuote } from '@/lib/quoteToken'
import { readJsonObject, ValidationError } from '@/lib/validation'
import { logServerError } from '@/lib/serverLog'

export const dynamic = 'force-dynamic'

async function handler(request: NextRequest, user: any) {
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const input = canonicalOrderInput(await readJsonObject(request))
    const calculation = await prisma.$transaction(tx => calculateCheckout(tx, input), {
      isolationLevel: 'RepeatableRead', maxWait: 5000, timeout: 15000,
    })
    const signed = issueQuote(user.userId, fingerprintOrderInput(input), calculation)
    return NextResponse.json({ success: true, data: { ...signed, currency: 'LKR',
      lines: calculation.items, totals: calculation.totals } }, { headers })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message, code: 'QUOTE_UNAVAILABLE' }, { status: error.status, headers })
    logServerError('Checkout quote unavailable', error)
    return NextResponse.json({ error: 'A checkout quote is temporarily unavailable.', code: 'QUOTE_UNAVAILABLE' }, { status: 503, headers })
  }
}

export const POST = requireAuth(handler)
