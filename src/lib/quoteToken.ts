import { createHash, createHmac } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { OrderRequestError } from './orderRequests'
import { pricingSnapshot, type CheckoutCalculation } from './checkoutCalculation'

export class QuoteError extends OrderRequestError {}

function signingKey(root = process.env.JWT_SECRET) {
  if (!root) throw new Error('Quote signing is unavailable')
  // Purpose separation is essential: a quote carrying userId must NEVER verify
  // with the session JWT key, even though both tokens use HS256.
  return createHmac('sha256', root).update('369-checkout-quote-v1').digest('hex')
}

export function pricingHash(calculation: CheckoutCalculation): string {
  return createHash('sha256').update(JSON.stringify(pricingSnapshot(calculation))).digest('hex')
}

type QuoteClaims = { kind: string; userId: number; inputHash: string; pricingHash: string; exp: number }

export function issueQuote(userId: number, inputHash: string, calculation: CheckoutCalculation,
  options: { rootSecret?: string; lifetimeSeconds?: number; now?: number } = {}) {
  const now = options.now ?? Math.floor(Date.now() / 1000)
  const expiresAt = now + (options.lifetimeSeconds ?? 120)
  const quoteToken = jwt.sign({ kind: 'checkout-quote-v1', userId, inputHash,
    pricingHash: pricingHash(calculation), iat: now, exp: expiresAt }, signingKey(options.rootSecret), {
    algorithm: 'HS256', issuer: '369-checkout', audience: 'order-creation',
  })
  return { quoteToken, expiresAt: new Date(expiresAt * 1000).toISOString() }
}

export function verifyQuote(value: unknown, userId: number, inputHash: string,
  options: { rootSecret?: string; now?: number } = {}): QuoteClaims {
  if (typeof value !== 'string' || !value) throw new QuoteError('Review a current checkout quote before placing an order.', 428, 'QUOTE_REQUIRED')
  if (value.length > 2048) throw new QuoteError('The checkout quote is invalid. Please review a new quote.', 400, 'QUOTE_INVALID')
  let claims: QuoteClaims
  try {
    claims = jwt.verify(value, signingKey(options.rootSecret), { algorithms: ['HS256'],
      issuer: '369-checkout', audience: 'order-creation', clockTimestamp: options.now }) as QuoteClaims
  } catch (error) {
    const expired = error instanceof jwt.TokenExpiredError
    throw new QuoteError(expired ? 'The checkout quote expired. Please review a new quote.' : 'The checkout quote could not be verified.',
      409, expired ? 'QUOTE_EXPIRED' : 'QUOTE_INVALID')
  }
  if (claims.kind !== 'checkout-quote-v1' || claims.userId !== userId || claims.inputHash !== inputHash ||
      !/^[a-f0-9]{64}$/.test(claims.pricingHash)) {
    throw new QuoteError('The quote belongs to another checkout. Please review a new quote.', 409, 'QUOTE_MISMATCH')
  }
  return claims
}

export function assertQuoteUnchanged(claims: QuoteClaims, calculation: CheckoutCalculation) {
  if (claims.pricingHash !== pricingHash(calculation)) {
    throw new QuoteError('Prices or checkout charges changed. Review a new quote before confirming.', 409, 'QUOTE_CHANGED')
  }
}
