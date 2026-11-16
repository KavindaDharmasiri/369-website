const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')
const { fingerprintOrderInput } = loadTypescript('src/lib/orderRequests.ts')
const { serializeOrderInput, validateOrderRequestKey } = loadTypescript('src/lib/orderRequestInput.ts')
const { prepareOrderAttempt, readOrderAttempt, clearOrderAttempt, browserOrderFingerprint } = loadTypescript('src/lib/checkoutAttempts.ts')
const input = {
  email: 'test@example.invalid', firstName: 'Test', lastName: 'Customer', address: 'Private street', apartment: '',
  city: 'City', state: 'Region', zipCode: '00000', phone: '0000000000', paymentMethod: 'cash',
  items: [{ productId: 1, skuId: 1, quantity: 2 }],
}
function storage() {
  const data = new Map()
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}
const fingerprint = async value => fingerprintOrderInput(value)
const createKey = () => 'checkout-client-0001'

test('canonical identity ignores client totals and line order while combining duplicate SKUs', () => {
  const equivalent = { ...input, address: ' Private street ', items: [
    { productId: 1, skuId: 1, quantity: 1, name: 'Spoofed', price: -1 },
    { productId: 1, skuId: 1, quantity: 1, specs: { injected: 'Ignored' } },
  ], total: -1 }
  assert.equal(fingerprintOrderInput(input), fingerprintOrderInput(equivalent))
  const ordered = { ...input, items: [...input.items, { productId: 2, skuId: null, quantity: 1 }] }
  assert.equal(serializeOrderInput(ordered), serializeOrderInput({ ...ordered, items: [...ordered.items].reverse() }))
})

test('browser and server produce the same SHA-256 fingerprint', async () => {
  assert.equal(await browserOrderFingerprint(input), fingerprintOrderInput(input))
})

test('opaque request keys are bounded and do not permit whitespace or path separators', () => {
  for (const key of [null, '', 'short', 'a'.repeat(129), 'checkout/request-0001', 'checkout request-0001', '💥'.repeat(20)]) assert.throws(() => validateOrderRequestKey(key))
  assert.equal(validateOrderRequestKey(createKey()), createKey())
})

test('same checkout reuses a persisted key after reload without storing delivery data', async () => {
  const local = storage()
  const first = await prepareOrderAttempt(local, 1, input, fingerprint, createKey)
  const freshModule = loadTypescript('src/lib/checkoutAttempts.ts')
  const replay = await freshModule.prepareOrderAttempt(local, 1, input, fingerprint, () => { throw new Error('Must not create another key') })
  assert.deepEqual(replay, first)
  const raw = local.getItem('orderAttempt:1')
  assert.doesNotMatch(raw, /Private street|test@example|0000000000/)
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['fingerprint', 'key'])
})

test('changed checkout is blocked without replacing an unconfirmed identity', async () => {
  const local = storage()
  await prepareOrderAttempt(local, 1, input, fingerprint, createKey)
  const before = local.getItem('orderAttempt:1')
  await assert.rejects(prepareOrderAttempt(local, 1, { ...input, phone: '1111111111' }, fingerprint, () => 'checkout-client-0002'), /earlier checkout/)
  assert.equal(local.getItem('orderAttempt:1'), before)
})

test('simultaneous same-tab preparations share one identity; clearing is key- and user-scoped', async () => {
  const local = storage()
  let generated = 0
  const generate = () => `checkout-client-${++generated}`
  const [first, second] = await Promise.all([
    prepareOrderAttempt(local, 1, input, fingerprint, generate), prepareOrderAttempt(local, 1, input, fingerprint, generate),
  ])
  assert.equal(first.key, second.key)
  assert.equal(generated, 1)
  await prepareOrderAttempt(local, 2, input, fingerprint, generate)
  clearOrderAttempt(local, 1, 'unrelated-key-0001')
  assert.equal(readOrderAttempt(local, 1).key, first.key)
  clearOrderAttempt(local, 1, first.key)
  assert.equal(readOrderAttempt(local, 1), null)
  assert.notEqual(readOrderAttempt(local, 2), null)
})

test('malformed identities and storage failures fail closed', async () => {
  const local = storage()
  local.setItem('orderAttempt:1', '{')
  await assert.rejects(prepareOrderAttempt(local, 1, input, fingerprint, createKey), /unreadable/)
  assert.equal(local.getItem('orderAttempt:1'), '{')
  const unavailable = storage()
  unavailable.setItem = () => { throw new Error('Storage unavailable') }
  await assert.rejects(prepareOrderAttempt(unavailable, 1, input, fingerprint, createKey), /Storage unavailable/)
})
