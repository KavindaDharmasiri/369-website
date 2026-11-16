const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')
const { paymentLabel, orderConfirmationText, loadCheckoutResources, checkoutTotalsDiffer, parseCheckoutQuote, quoteChangeText } = loadTypescript('src/lib/checkoutState.ts')
const { ClientRequestError, responseJson, mutationJson, createRequestGuard } = loadTypescript('src/lib/clientRequests.ts')

test('payment display never infers paid from card-on-delivery or fulfilment', () => {
  for (const status of ['PENDING', 'SHIPPED', 'DELIVERED', 'unknown']) assert.equal(paymentLabel(status), 'payment not confirmed')
  assert.equal(paymentLabel('paid'), 'paid')
  assert.equal(paymentLabel('REFUNDED'), 'refunded')
  assert.equal(paymentLabel('CANCELLED'), 'cancelled')
})

test('order confirmation returns plain text including literal untrusted values', () => {
  const name = '<img src=x onerror=alert(1)>'
  const text = orderConfirmationText({
    total: 100, itemSavings: 20, discount: 10, couponCode: '<b>SAVE</b>', paymentMethod: 'card',
    delivery: { firstName: name, lastName: 'Test', address: 'Street', apartment: '', city: 'City', state: 'Region', zipCode: '0', phone: '0' },
  })
  assert.equal(typeof text, 'string')
  assert.ok(text.includes(name))
  assert.ok(text.includes('Card on Delivery'))
  assert.ok(text.includes('LKR 100.00'))
  // The consumer must use SweetAlert's text property, never its HTML property.
  const fs = require('node:fs')
  const page = fs.readFileSync(require('node:path').join(__dirname, '../src/app/customer/cart/page.tsx'), 'utf8')
  assert.doesNotMatch(page, /\bhtml\s*:/)
  assert.match(page, /text: confirmationText/)
  assert.match(page, /orderConfirmationText\(/)
})

test('HTTP failures and invalid JSON are not interpreted as successful mutations', async () => {
  await assert.rejects(responseJson(Response.json({ error: 'Stock limit' }, { status: 409 })), error => {
    assert.ok(error instanceof ClientRequestError)
    assert.equal(error.message, 'Stock limit')
    assert.equal(error.uncertain, false)
    return true
  })
  await assert.rejects(responseJson(Response.json({ error: 'Unavailable' }, { status: 503 })), error => error.uncertain === true)
  await assert.rejects(responseJson(new Response('not json', { status: 200 })), error => error.uncertain === true)
  await assert.rejects(mutationJson(Response.json({ success: false })), error => error.uncertain === true)
  assert.deepEqual(await mutationJson(Response.json({ success: true })), { success: true })
})

test('late coupon results cannot overwrite a newer request or a changed bag', () => {
  const guard = createRequestGuard()
  const first = guard.next()
  const second = guard.next()
  assert.equal(guard.isCurrent(first), false)
  assert.equal(guard.isCurrent(second), true)
  guard.invalidate()
  assert.equal(guard.isCurrent(second), false)
})

test('quote totals compare in exact minor units and reject unreadable quotes', () => {
  const totals = { subtotal: 100, productDiscount: 10, shippingFee: 5, tax: 8, discount: 2, total: 101 }
  assert.equal(checkoutTotalsDiffer(totals, { ...totals }), false)
  // Floating-point noise must not trigger a review...
  assert.equal(checkoutTotalsDiffer({ ...totals, tax: 8.0000000001 }, totals), false)
  // ...but any real one-cent change must.
  assert.equal(checkoutTotalsDiffer({ ...totals, total: 101.01 }, totals), true)
  assert.equal(checkoutTotalsDiffer({ ...totals, tax: 8.01 }, totals), true)

  const quoted = parseCheckoutQuote({ quoteToken: 'a'.repeat(64), expiresAt: '2030-01-01T00:00:00.000Z', totals })
  assert.equal(quoted.quoteToken, 'a'.repeat(64))
  assert.deepEqual(quoted.totals, totals)
  for (const invalid of [
    null, {}, { quoteToken: '', expiresAt: '2030-01-01T00:00:00.000Z', totals },
    { quoteToken: 'x'.repeat(2049), expiresAt: '2030-01-01T00:00:00.000Z', totals },
    { quoteToken: 'a'.repeat(64), expiresAt: 'not-a-date', totals },
    { quoteToken: 'a'.repeat(64), expiresAt: '2030-01-01T00:00:00.000Z', totals: { ...totals, tax: -1 } },
    { quoteToken: 'a'.repeat(64), expiresAt: '2030-01-01T00:00:00.000Z', totals: { ...totals, total: 'NaN' } },
  ]) assert.throws(() => parseCheckoutQuote(invalid), /quote could not be read/i)
})

test('price-change review states both totals and that nothing was ordered', () => {
  const text = quoteChangeText(100, 112.5)
  assert.match(text, /LKR 100\.00/)
  assert.match(text, /LKR 112\.50/)
  assert.match(text, /Nothing has been ordered/)
})

test('checkout starts independent loads concurrently and waits for all before reporting failure', async () => {
  const started = []
  let release
  const gate = new Promise(resolve => { release = resolve })
  let settled = false
  const work = loadCheckoutResources([
    async () => { started.push('bag'); throw new Error('Bag unavailable') },
    async () => { started.push('shipping'); await gate },
    async () => { started.push('tax') },
    async () => { started.push('address') },
  ]).finally(() => { settled = true })
  const expectedFailure = assert.rejects(work, /Bag unavailable/)
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(started, ['bag', 'shipping', 'tax', 'address'])
  assert.equal(settled, false)
  release()
  await expectedFailure
  assert.equal(settled, true)
})

test('malformed legacy specifications do not crash server-cart enrichment', () => {
  const enrich = loadTypescript('src/lib/cartEnrich.ts', { '@/lib/clientEncryption': { decryptData: () => null } })
  const item = { product: { prodName: 'Product', prodPrice: 10, stockStatus: true }, specs: '{bad json' }
  assert.equal(enrich.enrichServerCartItem(item).specs, null)
  assert.deepEqual(enrich.parseCartSpecs('{"Size":"Small"}'), { Size: 'Small' })
  assert.equal(enrich.parseCartSpecs('["Small"]'), null)
  assert.equal(enrich.parseCartSpecs('{"Size":{}}'), null)
})
