import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { positiveId, quantityValue, readJsonObject, ValidationError } from '@/lib/validation'
import { resolveOrderItems } from '@/lib/orderItems'
import { cartTransaction } from '@/lib/cartTransactions'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const id = positiveId((await params).id)
    await cartTransaction(prisma, decoded.userId, tx => tx.cartItem.delete({
      where: { 
        id,
        userId: decoded.userId 
      }
    }))

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    if ((error as any)?.code === 'P2025') return NextResponse.json({ error: 'Cart item not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Delete cart item error', error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const id = positiveId((await params).id)
    const body = await readJsonObject(request)
    const quantity = quantityValue(body.quantity)
    const cartItem = await cartTransaction(prisma, decoded.userId, async tx => {
      const existing = await tx.cartItem.findFirst({ where: { id, userId: decoded.userId } })
      if (!existing) throw new ValidationError('Cart item not found', 404)
      await resolveOrderItems(tx, [{ productId: existing.productId, skuId: existing.skuId, quantity }], [])
      return tx.cartItem.update({
      where: { 
        id,
        userId: decoded.userId,
        revision: existing.revision,
      },
      data: { quantity }
      })
    })

    return NextResponse.json({ success: true, data: cartItem }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    if ((error as any)?.code === 'P2025') return NextResponse.json({ error: 'Cart item not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    logServerError('Update cart item error', error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
import { logServerError } from '@/lib/serverLog'
