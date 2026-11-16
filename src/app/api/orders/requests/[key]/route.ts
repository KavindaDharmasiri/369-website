import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { validateOrderRequestKey } from '@/lib/orderRequestInput'
import { OrderRequestError, settleOrderRequest } from '@/lib/orderRequests'
import { ValidationError } from '@/lib/validation'

const privateHeaders = { 'Cache-Control': 'private, no-store' }
const fail = (error: string, status: number, code?: string) =>
  NextResponse.json(code ? { error, code } : { error }, { status, headers: privateHeaders })

export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const user = token ? await loadActiveUser(verifyToken(token)) : null
    if (!user || !Number.isInteger(user.userId) || user.userId < 1) return fail('Unauthorized', 401)
    const key = validateOrderRequestKey((await params).key)
    const data = await settleOrderRequest(prisma, user.userId, key)
    return NextResponse.json({ success: true, data }, { headers: privateHeaders })
  } catch (error) {
    if (error instanceof OrderRequestError) return fail(error.message, error.status, error.code)
    if (error instanceof ValidationError) return fail(error.message, error.status)
    logServerError('Resolve checkout attempt error', error)
    return fail('The earlier checkout could not be resolved. Keep its key and try resolving it again.', 503)
  }
}
import { logServerError } from '@/lib/serverLog'
