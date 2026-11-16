import { createHash } from 'node:crypto'
import type { Order, Prisma, PrismaClient } from '@prisma/client'
import { serializeOrderInput } from './orderRequestInput'
import { ValidationError } from './validation'

export class OrderRequestError extends ValidationError {
  constructor(message: string, status: number, public code: string) {
    super(message, status)
  }
}

export interface OrderReply { orderNumber: string; orderId: number; status: string }
type RequestResult = { replayed: true; response: OrderReply } | { replayed: false; response: OrderReply; order: Order }

export function fingerprintOrderInput(value: unknown): string {
  return createHash('sha256').update(serializeOrderInput(value)).digest('hex')
}

type Receipt = { requestHash: string; response: unknown; orderId: number | null }

function isAbandoned(receipt: Receipt): boolean {
  return receipt.orderId === null && !!receipt.response && typeof receipt.response === 'object' &&
    (receipt.response as { kind?: string }).kind === 'abandoned'
}

function replayReceipt(receipt: Receipt, hash: string): RequestResult {
  if (isAbandoned(receipt)) {
    throw new OrderRequestError('This checkout attempt was retired. Start a new checkout with a new key.', 409, 'ORDER_REQUEST_ABANDONED')
  }
  if (receipt.requestHash !== hash) {
    throw new OrderRequestError('This Idempotency-Key belongs to a different checkout. Check My Orders before starting a new order.', 409, 'IDEMPOTENCY_CONFLICT')
  }
  const response = receipt.response as Partial<OrderReply> | null
  if (!response || !Number.isInteger(response.orderId) || Number(response.orderId) < 1 ||
      typeof response.orderNumber !== 'string' || typeof response.status !== 'string') {
    throw new OrderRequestError('This order request cannot yet be confirmed. Keep the same key and check My Orders.', 409, 'ORDER_REQUEST_UNCONFIRMED')
  }
  return { replayed: true, response: { orderNumber: response.orderNumber, orderId: response.orderId!, status: response.status } }
}

export type OrderRequestSettlement = { state: 'abandoned' } | { state: 'completed'; order: OrderReply }

function settledReceipt(receipt: Receipt): OrderRequestSettlement {
  if (isAbandoned(receipt)) return { state: 'abandoned' }
  return { state: 'completed', order: replayReceipt(receipt, receipt.requestHash).response }
}

// This retires an attempt identity, NEVER cancels an existing order. The same
// unique constraint waits for an in-flight creation to commit or roll back.
export async function settleOrderRequest(db: PrismaClient, userId: number, key: string): Promise<OrderRequestSettlement> {
  const where = { userId_key: { userId, key } }
  const previous = await db.orderRequest.findUnique({ where })
  if (previous) return settledReceipt(previous)
  try {
    await db.$transaction(async (tx) => {
      await tx.orderRequest.create({ data: { userId, key, requestHash: '0'.repeat(64), response: { kind: 'abandoned' } } })
    }, { maxWait: 5000, timeout: 15000 })
    return { state: 'abandoned' }
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      const winner = await db.orderRequest.findUnique({ where })
      if (winner) return settledReceipt(winner)
    }
    throw error
  }
}

export async function runOrderRequest<T = undefined>(
  db: PrismaClient, userId: number, key: string, hash: string,
  createOrder: (tx: Prisma.TransactionClient, authorization: T) => Promise<Order>,
  authorize?: () => T | Promise<T>,
): Promise<RequestResult> {
  const where = { userId_key: { userId, key } }
  const previous = await db.orderRequest.findUnique({ where })
  if (previous) return replayReceipt(previous, hash)
  // Stateless authorization runs only for a genuinely new attempt, before any
  // write. A committed replay must not be blocked by an expired quote for work
  // that already succeeded.
  const authorization = (authorize ? await authorize() : undefined) as T
  try {
    return await db.$transaction(async (tx) => {
      // Claim identity before touching stock/coupons. PostgreSQL's unique index
      // blocks a competing insert until this whole transaction commits/rolls back.
      const receipt = await tx.orderRequest.create({ data: { userId, key, requestHash: hash } })
      const order = await createOrder(tx, authorization)
      const response = { orderNumber: order.orderNumber, orderId: order.id, status: order.status }
      await tx.orderRequest.update({ where: { id: receipt.id }, data: { orderId: order.id, response } })
      return { replayed: false as const, response, order }
    }, { maxWait: 5000, timeout: 15000 })
  } catch (error) {
    // Read only AFTER Prisma has rolled the failed transaction back. Any other
    // unique failure is not a replay unless this user's exact key now exists.
    if ((error as { code?: string })?.code === 'P2002') {
      const winner = await db.orderRequest.findUnique({ where })
      if (winner) return replayReceipt(winner, hash)
    }
    if (error instanceof ValidationError && !(error instanceof OrderRequestError)) {
      throw new OrderRequestError(error.message, error.status, 'ORDER_NOT_CREATED')
    }
    throw error
  }
}
