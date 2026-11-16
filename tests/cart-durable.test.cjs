const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')
const cart = loadTypescript('src/lib/cartTransactions.ts')
const guest = loadTypescript('src/lib/guestCart.ts')
const item = { productId: 1, skuId: 2, quantity: 1 }

function storage(items = [item]) {
  const values = new Map([['cart', JSON.stringify(items)]])
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}

test('cart merge canonical identity ignores price/spec snapshots and combines/sorts SKU quantities', () => {
  assert.deepEqual(cart.canonicalCartMerge({ items: [{ ...item, price: -1, specs: { Size: 'M' } }, item] }), [{ ...item, quantity: 2 }])
  for (const body of [{}, { items: [] }, { items: [item, { ...item, quantity: 1000 }] }, { items: [{ ...item, quantity: -1 }] }]) {
    assert.throws(() => cart.canonicalCartMerge(body))
  }
})

test('durable guest import persists identity before sending and checkpoints only acknowledged snapshot', async () => {
  const s = storage()
  const result = await guest.mergeGuestCartDurably(s, 7, async (items, key) => {
    assert.deepEqual(items, [item])
    assert.equal(JSON.parse(s.getItem(guest.GUEST_CART_BATCH_KEY)).key, key)
    assert.notEqual(s.getItem('cart'), null)
    return { acknowledged: true, requestKey: key }
  })
  assert.equal(result.migrated, 1)
  assert.equal(s.getItem('cart'), null)
  assert.equal(s.getItem(guest.GUEST_CART_BATCH_KEY), null)
})

test('lost response retries exact owner/key/payload after reloading helper state', async () => {
  const s = storage()
  let firstKey
  const first = await guest.mergeGuestCartDurably(s, 7, async (_, key) => { firstKey = key; throw new Error('lost response') })
  assert.equal(first.uncertain, true)
  const reloaded = loadTypescript('src/lib/guestCart.ts')
  const second = await reloaded.mergeGuestCartDurably(s, 7, async (items, key) => {
    assert.equal(key, firstKey)
    assert.deepEqual(items, [item])
    return { acknowledged: true, requestKey: key }
  })
  assert.equal(second.migrated, 1)
})

test('other-owner and legacy uncertain imports never send a new batch', async () => {
  const s = storage()
  await guest.mergeGuestCartDurably(s, 7, async () => { throw new Error('lost') })
  let calls = 0
  const transfer = async () => { calls++; return { acknowledged: true } }
  assert.equal((await guest.mergeGuestCartDurably(s, 8, transfer)).uncertain, true)
  s.removeItem(guest.GUEST_CART_BATCH_KEY)
  s.setItem(guest.GUEST_CART_RECEIPT_KEY, '{}')
  assert.equal((await guest.mergeGuestCartDurably(s, 7, transfer)).uncertain, true)
  assert.equal(calls, 0)
})

test('failed identity persistence prevents any HTTP import', async () => {
  const s = storage()
  s.setItem = () => { throw new Error('storage blocked') }
  let calls = 0
  await assert.rejects(guest.mergeGuestCartDurably(s, 7, async () => { calls++ }))
  assert.equal(calls, 0)
  assert.notEqual(s.getItem('cart'), null)
})

test('browsers without cross-tab Web Locks cannot create competing new import identities', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true })
  try {
    const s = storage()
    let calls = 0
    const result = await guest.mergeGuestCartDurably(s, 7, async () => { calls++; return { acknowledged: true } })
    assert.equal(calls, 0)
    assert.equal(result.migrated, 0)
    assert.notEqual(s.getItem('cart'), null)
    assert.equal(s.getItem(guest.GUEST_CART_BATCH_KEY), null)
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else delete globalThis.window
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator)
    else delete globalThis.navigator
  }
})

test('changed saved bag or changed session never gets overwritten by acknowledgement', async () => {
  for (const changeSession of [true, false]) {
    const s = storage()
    let sameSession = true
    const result = await guest.mergeGuestCartDurably(s, 7, async (_, key) => {
      if (changeSession) sameSession = false
      else s.setItem('cart', JSON.stringify([{ ...item, quantity: 5 }]))
      return { acknowledged: true, requestKey: key }
    }, () => sameSession)
    assert.equal(result.uncertain, true)
    assert.notEqual(s.getItem('cart'), null)
    assert.notEqual(s.getItem(guest.GUEST_CART_BATCH_KEY), null)
  }
})

test('only definitive no-write rejection can clear identity; uncertain failures preserve it', async () => {
  for (const definitive of [true, false]) {
    const s = storage()
    await guest.mergeGuestCartDurably(s, 7, async () => ({ acknowledged: false, definitive }))
    assert.equal(s.getItem(guest.GUEST_CART_BATCH_KEY) === null, definitive)
    assert.notEqual(s.getItem('cart'), null)
  }
})

test('mismatched acknowledgement never erases the saved bag', async () => {
  const s = storage()
  const result = await guest.mergeGuestCartDurably(s, 7, async () => ({ acknowledged: true, requestKey: 'other-import-key-01' }))
  assert.equal(result.uncertain, true)
  assert.notEqual(s.getItem('cart'), null)
})

test('failed local checkpoint retains durable identity and never auto-issues another key', async () => {
  const s = storage()
  const remove = s.removeItem
  s.removeItem = key => { if (key === 'cart') throw new Error('storage unavailable'); remove(key) }
  let firstKey
  const result = await guest.mergeGuestCartDurably(s, 7, async (_, key) => {
    firstKey = key
    return { acknowledged: true, requestKey: key }
  })
  assert.equal(result.uncertain, true)
  s.removeItem = remove
  await guest.mergeGuestCartDurably(s, 7, async (_, key) => {
    assert.equal(key, firstKey)
    return { acknowledged: true, requestKey: key }
  })
  assert.equal(s.getItem('cart'), null)
})

test('checkout clearing filters by submitted identity/quantity and current revision', async () => {
  let query
  const tx = { cartItem: { deleteMany: async args => { query = args } } }
  await cart.clearSubmittedCart(tx, 7, [
    { id: 1, productId: 1, skuId: 2, quantity: 2, revision: 4 },
    { id: 2, productId: 3, skuId: null, quantity: 1, revision: 5 },
  ], [{ productId: 1, skuId: 2, quantity: 2 }])
  assert.deepEqual(query.where, { userId: 7, OR: [{ id: 1, revision: 4, quantity: 2 }] })
})

test('merge route fails closed when storage/migration is unavailable and redacts internal details', async () => {
  const route = loadTypescript('src/app/api/cart/merge/route.ts', {
    '@/lib/apiMiddleware': { requireAuth: handler => req => handler(req, { userId: 7 }) },
    '@/lib/db': { $transaction: async () => { throw new Error('private DB detail') } },
  })
  const response = await route.POST(new Request('http://localhost/api/cart/merge', {
    method: 'POST', headers: { 'Idempotency-Key': 'cart-test-key-00001' }, body: JSON.stringify({ items: [item] }),
  }))
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const body = await response.json()
  assert.equal(body.code, 'CART_MERGE_UNCONFIRMED')
  assert.doesNotMatch(JSON.stringify(body), /private DB detail/)
})
