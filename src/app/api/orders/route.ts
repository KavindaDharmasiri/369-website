import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { createNotification, notifyLowStock } from '@/lib/notify'
import { readJsonObject, ValidationError } from '@/lib/validation'
import { reserveOrderStock } from '@/lib/orderItems'
import { calculateCheckout } from '@/lib/checkoutCalculation'
import { assertQuoteUnchanged, verifyQuote } from '@/lib/quoteToken'
import { canonicalOrderInput, validateOrderRequestKey } from '@/lib/orderRequestInput'
import { fingerprintOrderInput, OrderRequestError, runOrderRequest } from '@/lib/orderRequests'
import { clearSubmittedCart, lockUserCart } from '@/lib/cartTransactions'

const privateHeaders = { 'Cache-Control': 'private, no-store' }
const fail = (error: string, status: number, code?: string) =>
  NextResponse.json(code ? { error, code } : { error }, { status, headers: privateHeaders })

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return fail('Unauthorized', 401)
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) {
      return fail('Invalid token', 401)
    }
    const body = await readJsonObject(request)
    const input = canonicalOrderInput(body)
    const requestKey = validateOrderRequestKey(request.headers.get('Idempotency-Key'))
    const requestHash = fingerprintOrderInput(input)
    const {
      email, firstName, lastName, address, apartment, city, state, zipCode, phone,
      paymentMethod
    } = input

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Create order with complete transaction rollback on any failure. Quote
    // verification is stateless, runs before the write transaction, and is
    // skipped only for a committed replay of the same owner/key/input.
    const outcome = await runOrderRequest(prisma, decoded.userId, requestKey, requestHash, async (tx, acceptedQuote) => {
      await lockUserCart(tx, decoded.userId)
      const cartSnapshot = await tx.cartItem.findMany({ where: { userId: decoded.userId },
        select: { id: true, productId: true, skuId: true, quantity: true, revision: true } })
      const calculation = await calculateCheckout(tx, input)
      assertQuoteUnchanged(acceptedQuote, calculation)
      const resolvedItems = calculation.items
      const { subtotal, productDiscount, shippingFee, tax, discount, total } = calculation.totals
      const appliedCoupon = calculation.coupon

      await reserveOrderStock(tx, resolvedItems)

      // A conditional update protects the final coupon use under concurrent orders.
      if (appliedCoupon) {
        const reserved = await tx.coupon.updateMany({
          where: {
            id: appliedCoupon.id, isActive: true,
            maxUses: appliedCoupon.maxUses,
            discountType: appliedCoupon.discountType, discountValue: appliedCoupon.discountValue,
            validFrom: appliedCoupon.validFrom, validUntil: appliedCoupon.validUntil,
            minSubtotal: appliedCoupon.minSubtotal, maxDiscount: appliedCoupon.maxDiscount,
            ...(appliedCoupon.maxUses != null ? { usedCount: { lt: appliedCoupon.maxUses } } : {}),
          },
          data: { usedCount: { increment: 1 } },
        })
        if (reserved.count !== 1) throw new ValidationError('Coupon is no longer available. Please refresh your cart.', 409)
      }

      // Create the order
      const newOrder = await tx.order.create({
        data: {
          userId: decoded.userId,
          orderNumber,
          email,
          firstName,
          lastName,
          address,
          apartment,
          city,
          state,
          zipCode,
          phone,
          subtotal,
          shippingFee,
          tax,
          discount,
          productDiscount,
          couponCode: appliedCoupon ? appliedCoupon.code : null,
          couponId: appliedCoupon ? appliedCoupon.id : null,
          total,
          paymentMethod,
          status: 'PENDING'
        }
      })

      // All writes are covered by this transaction, including prior reservations.
      for (const item of resolvedItems) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            skuId: item.skuId,
            productName: item.productName,
            specs: item.specs,
            price: item.price,
            originalPrice: item.originalPrice,
            quantity: item.quantity,
            subtotal: item.subtotal
          }
        })
      }

      // Do not erase unrelated items or quantities edited since this checkout.
      await clearSubmittedCart(tx, decoded.userId, cartSnapshot, resolvedItems)

      return newOrder
    }, () => verifyQuote(body.quoteToken, decoded.userId, requestHash))

    if (!outcome.replayed) {
      const result = outcome.order
      await Promise.all([
      createNotification({
        type: 'ORDER_PLACED',
        title: 'New Order',
        message: `Order ${result.orderNumber} for LKR ${Number(result.total).toFixed(2)} has been placed.`,
        entityId: String(result.id),
      }).catch(() => null),
      notifyLowStock().catch(() => null),
      ])
    }

    return NextResponse.json({ 
      success: true, 
      data: outcome.response
    }, { headers: { ...privateHeaders, 'Idempotency-Replayed': String(outcome.replayed) } })
    
  } catch (error) {
    if (error instanceof OrderRequestError) return fail(error.message, error.status, error.code)
    if (error instanceof ValidationError) return fail(error.message, error.status, 'INVALID_ORDER_REQUEST')
    logServerError('Create order error', error)
    
    // Only typed validation errors above may expose a caller-safe message.
    // Matching words in an unknown Prisma/provider error can leak SQL or PII.
    return fail('Failed to create order', 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return fail('Unauthorized', 401)
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) {
      return fail('Invalid token', 401)
    }
    
    // Admin can see all orders, customers see only their orders
    const orders = await prisma.order.findMany({
      where: decoded.userType === 'admin' ? {} : { userId: decoded.userId },
      include: { orderItems: true },
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    return NextResponse.json({ success: true, data: { orders } }, { headers: privateHeaders })
  } catch (error) {
    logServerError('Get orders error', error)
    return fail('Failed to fetch orders', 500)
  }
}
import { logServerError } from '@/lib/serverLog'
