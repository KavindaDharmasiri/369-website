import type { Prisma, PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { MAX_ORDER_LINES, objectValue, parseCartInput, quantityValue, ValidationError } from './validation'
import { resolveOrderItems } from './orderItems'

export class CartRequestError extends ValidationError {
  constructor(message: string, status: number, public code: string) {
    super(message, status)
  }
}

export function canonicalCartMerge(value: unknown) {
  const body = objectValue(value)
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_ORDER_LINES) {
    throw new ValidationError(`Import must contain between 1 and ${MAX_ORDER_LINES} items`)
  }
  const combined = new Map<string, { productId: number; skuId: number | null; quantity: number }>()
  for (const raw of body.items) {
    const { productId, skuId, quantity } = parseCartInput(raw)
    const key = `${productId}:${skuId ?? 'base'}`
    combined.set(key, { productId, skuId, quantity: quantityValue(quantity + (combined.get(key)?.quantity ?? 0)) })
  }
  return Array.from(combined.values()).sort((a, b) => a.productId - b.productId || (a.skuId ?? 0) - (b.skuId ?? 0))
}

export type CartLines = ReturnType<typeof canonicalCartMerge>
export type CartMergeReply = { requestKey: string; mergedLines: number; quantityAdded: number }

/** Same namespace for add/patch/delete/merge/checkout; released on commit/rollback. */
export async function lockUserCart(tx: Prisma.TransactionClient, userId: number) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(36901, ${userId}::integer)`
}

export async function cartTransaction<T>(db: PrismaClient, userId: number, work: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async tx => {
    await lockUserCart(tx, userId)
    return work(tx)
  }, { maxWait: 5000, timeout: 30000 })
}

/** Caller holds the owner's cart lock. No stock reservation occurs for a bag. */
export async function appendCartLines(tx: Prisma.TransactionClient, userId: number, lines: CartLines) {
  const existing = await tx.cartItem.findMany({ where: { userId,
    OR: lines.map(line => ({ productId: line.productId, skuId: line.skuId })) } })
  const quantities = lines.map(line => {
    const matches = existing.filter(row => row.productId === line.productId && row.skuId === line.skuId)
    if (matches.length > 1) throw new ValidationError('Duplicate saved bag lines require review before importing.', 409)
    return { ...line, quantity: quantityValue(line.quantity + (matches[0]?.quantity ?? 0)) }
  })
  // Resolve the entire effective batch before the first write, not line by line.
  const resolved = await resolveOrderItems(tx, quantities, [])
  const result = []
  for (const line of resolved) {
    const previous = existing.find(row => row.productId === line.productId && row.skuId === line.skuId)
    if (previous) {
      const changed = await tx.cartItem.updateMany({
        where: { id: previous.id, userId, revision: previous.revision },
        data: { quantity: line.quantity, specs: line.specs },
      })
      if (changed.count !== 1) throw new ValidationError('Your bag changed. Refresh before retrying.', 409)
      result.push(await tx.cartItem.findUniqueOrThrow({ where: { id: previous.id } }))
    } else {
      result.push(await tx.cartItem.create({ data: { userId, productId: line.productId,
        skuId: line.skuId, quantity: line.quantity, specs: line.specs } }))
    }
  }
  return result
}

export async function mergeCartBatch(db: PrismaClient, userId: number, key: string, lines: CartLines) {
  const hash = createHash('sha256').update(JSON.stringify(lines)).digest('hex')
  try {
    return await cartTransaction(db, userId, async tx => {
      const previous = await tx.cartMergeRequest.findUnique({ where: { userId_key: { userId, key } } })
      if (previous) {
        if (previous.requestHash !== hash) throw new CartRequestError('This key belongs to a different saved bag.', 409, 'IDEMPOTENCY_CONFLICT')
        const response = previous.response as unknown as CartMergeReply
        if (response?.requestKey !== key || !Number.isInteger(response.mergedLines) || !Number.isInteger(response.quantityAdded)) {
          throw new CartRequestError('The earlier import could not be confirmed. Keep your saved bag.', 409, 'CART_MERGE_UNCONFIRMED')
        }
        return { response, replayed: true }
      }
      await appendCartLines(tx, userId, lines)
      const response = { requestKey: key, mergedLines: lines.length,
        quantityAdded: lines.reduce((sum, line) => sum + line.quantity, 0) }
      await tx.cartMergeRequest.create({ data: { userId, key, requestHash: hash, response } })
      return { response, replayed: false }
    })
  } catch (error) {
    if (error instanceof ValidationError && !(error instanceof CartRequestError)) {
      throw new CartRequestError(error.message, error.status, 'CART_NOT_MERGED')
    }
    throw error
  }
}

/** Clear only unchanged submitted snapshots, never unrelated or concurrently edited rows. */
export async function clearSubmittedCart(tx: Prisma.TransactionClient, userId: number,
  snapshot: { id: number; productId: number; skuId: number | null; quantity: number; revision: number }[], lines: CartLines) {
  const submitted = snapshot.filter(row => lines.some(line => line.productId === row.productId &&
    line.skuId === row.skuId && line.quantity === row.quantity))
  if (!submitted.length) return
  await tx.cartItem.deleteMany({ where: { userId, OR: submitted.map(row => ({
    id: row.id, revision: row.revision, quantity: row.quantity,
  })) } })
}
