import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'
import { canonicalCartMerge, CartRequestError, mergeCartBatch } from '@/lib/cartTransactions'
import { validateOrderRequestKey } from '@/lib/orderRequestInput'
import { readJsonObject, ValidationError } from '@/lib/validation'

async function handler(request: NextRequest, user: any) {
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const key = validateOrderRequestKey(request.headers.get('Idempotency-Key'))
    const lines = canonicalCartMerge(await readJsonObject(request))
    const result = await mergeCartBatch(prisma, user.userId, key, lines)
    return NextResponse.json({ success: true, data: result.response }, {
      headers: { ...headers, 'Idempotency-Replayed': String(result.replayed) },
    })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message,
      code: error instanceof CartRequestError ? error.code : 'CART_NOT_MERGED' }, { status: error.status, headers })
    logServerError('Cart merge unconfirmed', error)
    return NextResponse.json({ error: 'Import could not be confirmed. Keep the same key and saved items.',
      code: 'CART_MERGE_UNCONFIRMED' }, { status: 503, headers })
  }
}

export const POST = requireAuth(handler)
import { logServerError } from '@/lib/serverLog'
