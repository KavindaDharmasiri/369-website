const { test } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const { loadTypescript } = require('./load-typescript.cjs')

// Quote signing is purpose-derived from this key. A test-only value keeps the
// suite offline and deterministic without reading production configuration.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-quote-signing-secret'

const money = loadTypescript('src/lib/money.ts')
const quote = loadTypescript('src/lib/quoteToken.ts')

const calculation = (overrides = {}) => ({
  items: [{
    productId: 1, skuId: 1, quantity: 2, price: 90, originalPrice: 100, subtotal: 180,
    productName: 'Trusted', skuCode: 'SKU-1', variantKeys: 'Small',
  }],
  totals: { subtotal: 180, productDiscount: 20, shippingFee: 10, tax: 14.4, discount: 0, total: 204.4 },
  coupon: null,
  policy: { version: 1, currency: 'LKR', taxBasis: 'legacy-subtotal-before-coupon', taxMode: 'percentage', taxRate: '8' },
  ...overrides,
})

function expectQuoteError(action, code, status) {
  assert.throws(action, (error) => {
    assert.equal(error.code, code)
    assert.equal(error.status, status)
    return true
  })
}

test('money parsing rounds half-up at exact minor-unit boundaries', () => {
  assert.equal(money.moneyMinor('10.005'), 1001)
  assert.equal(money.moneyMinor('1.005'), 101)
  assert.equal(money.moneyMinor('1.004'), 100)
  assert.equal(money.moneyMinor('0.004'), 0)
  assert.equal(money.moneyMinor('0.005'), 1)
  assert.equal(money.moneyMinor(19.99), 1999)
  assert.equal(money.moneyMinor('1e2'), 10000)
  assert.equal(money.moneyMinor('1.5e1'), 1500)
  assert.equal(money.moneyMinor('1e-2'), 1)
})

test('money parsing rejects malformed, negative and unsafe inputs', () => {
  for (const value of ['', ' ', '-1', '+', '1,000', '1.2.3', 'abc', 'NaN', 'Infinity', '1e999', null, undefined, {}]) {
    assert.throws(() => money.moneyMinor(value), /(amount|range|decimal)/i, String(value))
  }
})

test('minor-unit conversion enforces the supported money range', () => {
  assert.equal(money.fromMinor(0), 0)
  assert.equal(money.fromMinor(money.MAX_MONEY_MINOR), money.MAX_MONEY_MINOR / 100)
  for (const value of [-1, 1.5, money.MAX_MONEY_MINOR + 1, Number.NaN]) {
    assert.throws(() => money.fromMinor(value), /range/i, String(value))
  }
  assert.equal(money.roundMoney('1.005'), 1.01)
  assert.equal(money.roundMoney('1.004'), 1)
})

test('percentages and discounts use the same exact minor-unit policy', () => {
  assert.equal(money.percentageMinor(1000, '8'), 80)
  assert.equal(money.percentageMinor(1005, '8'), 80)
  assert.equal(money.percentageMinor(0, '8'), 0)
  assert.equal(money.discountedMinor(10000, '10'), 9000)
  assert.equal(money.discountedMinor(10000, '0'), 10000)
  assert.equal(money.discountedMinor(1, '50'), 1)
  assert.equal(money.discountedMinor(10000, '100'), 0)
  assert.throws(() => money.discountedMinor(10000, '100.01'), /percentage/i)
  assert.throws(() => money.percentageMinor(-1, '8'), /range/i)
})

test('line amounts and sums stay exact across floating-point fractions', () => {
  assert.equal(money.lineAmount('19.99', 3), 59.97)
  assert.equal(money.lineAmount('0.10', 3), 0.3)
  assert.equal(money.sumMoney(['0.10', '0.20']), 0.3)
  assert.equal(money.sumMoney([]), 0)
  for (const quantity of [0, -1, 1.5, '2', null]) {
    assert.throws(() => money.lineAmount('1.00', quantity), /quantity/i, String(quantity))
  }
})

test('quote issue/verify round-trips owner, input and pricing identity', () => {
  const issued = quote.issueQuote(7, 'a'.repeat(64), calculation(), { lifetimeSeconds: 60, now: 1000 })
  assert.equal(issued.expiresAt, new Date(1060 * 1000).toISOString())
  const claims = quote.verifyQuote(issued.quoteToken, 7, 'a'.repeat(64), { now: 1001 })
  assert.equal(claims.userId, 7)
  assert.equal(claims.inputHash, 'a'.repeat(64))
  assert.equal(claims.kind, 'checkout-quote-v1')
  assert.match(claims.pricingHash, /^[a-f0-9]{64}$/)
})

test('quote absence and malformed tokens fail with QUOTE_REQUIRED/QUOTE_INVALID', () => {
  expectQuoteError(() => quote.verifyQuote(undefined, 1, 'a'.repeat(64)), 'QUOTE_REQUIRED', 428)
  expectQuoteError(() => quote.verifyQuote('', 1, 'a'.repeat(64)), 'QUOTE_REQUIRED', 428)
  expectQuoteError(() => quote.verifyQuote(42, 1, 'a'.repeat(64)), 'QUOTE_REQUIRED', 428)
  expectQuoteError(() => quote.verifyQuote('x'.repeat(2049), 1, 'a'.repeat(64)), 'QUOTE_INVALID', 400)
  expectQuoteError(() => quote.verifyQuote('not-a-jwt', 1, 'a'.repeat(64)), 'QUOTE_INVALID', 409)
})

test('expired quotes fail with QUOTE_EXPIRED and cannot be replayed', () => {
  const issued = quote.issueQuote(1, 'b'.repeat(64), calculation(), { lifetimeSeconds: 10, now: 1000 })
  expectQuoteError(() => quote.verifyQuote(issued.quoteToken, 1, 'b'.repeat(64), { now: 1011 }), 'QUOTE_EXPIRED', 409)
  assert.equal(quote.verifyQuote(issued.quoteToken, 1, 'b'.repeat(64), { now: 1009 }).userId, 1)
})

test('quotes are bound to owner and canonical input hash', () => {
  const issued = quote.issueQuote(1, 'c'.repeat(64), calculation(), { now: 1000 })
  expectQuoteError(() => quote.verifyQuote(issued.quoteToken, 2, 'c'.repeat(64), { now: 1001 }), 'QUOTE_MISMATCH', 409)
  expectQuoteError(() => quote.verifyQuote(issued.quoteToken, 1, 'd'.repeat(64), { now: 1001 }), 'QUOTE_MISMATCH', 409)
})

test('session JWTs signed with the root secret never verify as checkout quotes', () => {
  const session = jwt.sign({ kind: 'checkout-quote-v1', userId: 1, inputHash: 'e'.repeat(64),
    pricingHash: 'f'.repeat(64) }, process.env.JWT_SECRET, {
    algorithm: 'HS256', issuer: '369-checkout', audience: 'order-creation', expiresIn: 120,
  })
  expectQuoteError(() => quote.verifyQuote(session, 1, 'e'.repeat(64)), 'QUOTE_INVALID', 409)
})

test('a token signed with a different root secret is rejected', () => {
  const issued = quote.issueQuote(1, 'a'.repeat(64), calculation(), { rootSecret: 'one', now: 1000 })
  expectQuoteError(() => quote.verifyQuote(issued.quoteToken, 1, 'a'.repeat(64), { rootSecret: 'two', now: 1001 }), 'QUOTE_INVALID', 409)
})

test('pricing changes after issue surface as QUOTE_CHANGED, not a silent accept', () => {
  const issued = quote.issueQuote(1, 'a'.repeat(64), calculation(), { now: 1000 })
  const claims = quote.verifyQuote(issued.quoteToken, 1, 'a'.repeat(64), { now: 1001 })
  quote.assertQuoteUnchanged(claims, calculation())

  const changes = [
    calculation({ totals: { ...calculation().totals, total: 204.41 } }),
    calculation({ totals: { ...calculation().totals, tax: 14.41 } }),
    calculation({ items: [{ ...calculation().items[0], price: 89.99, subtotal: 179.98 }] }),
    calculation({ coupon: { id: 9 } }),
    calculation({ policy: { ...calculation().policy, taxRate: '9' } }),
  ]
  for (const changed of changes) {
    expectQuoteError(() => quote.assertQuoteUnchanged(claims, changed), 'QUOTE_CHANGED', 409)
  }
})
