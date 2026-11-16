const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')
const guest = loadTypescript('src/lib/guestCart.ts')
const { mergeGuestCart, readGuestCart, removeSavedGuestItem, guestLineMatches, withGuestCartLock, GUEST_CART_KEY, GUEST_CART_RECEIPT_KEY } = guest
const first = { productId: 1, skuId: 10, quantity: 2, name: 'First' }
const second = { productId: 2, skuId: 20, quantity: 1, name: 'Second' }

function storage(items = [first, second]) {
  const data = new Map([[GUEST_CART_KEY, JSON.stringify(items)]])
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
    removeItem: key => { data.delete(key) },
  }
}

test('saved items merge into a nonempty account bag and are checkpointed only after acknowledgement', async () => {
  const local = storage()
  const account = [{ productId: 99, quantity: 1 }]
  let calls = 0
  const result = await mergeGuestCart(local, async item => {
    assert.notEqual(local.getItem(GUEST_CART_RECEIPT_KEY), null)
    assert.deepEqual(readGuestCart(local), calls === 0 ? [first, second] : [second])
    account.push(item)
    calls++
    return { acknowledged: true }
  })
  assert.equal(result.migrated, 2)
  assert.deepEqual(account, [{ productId: 99, quantity: 1 }, first, second])
  assert.deepEqual(result.pending, [])
  assert.equal(local.getItem(GUEST_CART_KEY), null)
  assert.equal(local.getItem(GUEST_CART_RECEIPT_KEY), null)
})

test('a rejected item and all unprocessed items remain, while acknowledged items are not replayed', async () => {
  const local = storage()
  const sent = []
  const result = await mergeGuestCart(local, async item => {
    sent.push(item.productId)
    return item.productId === 1 ? { acknowledged: true } : { acknowledged: false, message: 'Select a variant' }
  })
  assert.equal(result.migrated, 1)
  assert.deepEqual(result.pending, [second])
  assert.equal(result.message, 'Select a variant')
  assert.equal(local.getItem(GUEST_CART_RECEIPT_KEY), null)
  await mergeGuestCart(local, async item => { sent.push(item.productId); return { acknowledged: true } })
  assert.deepEqual(sent, [1, 2, 2])
})

test('a lost response preserves items and a receipt that blocks automatic replay after reload', async () => {
  const local = storage()
  const result = await mergeGuestCart(local, async () => { throw new Error('Connection lost') })
  assert.equal(result.uncertain, true)
  assert.deepEqual(readGuestCart(local), [first, second])
  assert.notEqual(local.getItem(GUEST_CART_RECEIPT_KEY), null)
  // A fresh module is equivalent to reloading the tab; the persisted receipt remains.
  let resent = false
  const reloaded = loadTypescript('src/lib/guestCart.ts')
  const retried = await reloaded.mergeGuestCart(local, async () => { resent = true; return { acknowledged: true } })
  assert.equal(resent, false)
  assert.equal(retried.uncertain, true)
})

test('an uncertain server failure is not treated as a rejected/no-write operation', async () => {
  const local = storage()
  const result = await mergeGuestCart(local, async () => ({ acknowledged: false, uncertain: true, message: 'Server unavailable' }))
  assert.equal(result.uncertain, true)
  assert.deepEqual(result.pending, [first, second])
  assert.notEqual(local.getItem(GUEST_CART_RECEIPT_KEY), null)
})

test('failed local checkpoint after an acknowledged import keeps items and blocks replay', async () => {
  const local = storage()
  const write = local.setItem
  local.setItem = (key, value) => {
    if (key === GUEST_CART_KEY) throw new Error('Storage quota')
    write(key, value)
  }
  const result = await mergeGuestCart(local, async () => ({ acknowledged: true }))
  assert.equal(result.uncertain, true)
  assert.deepEqual(result.pending, [first, second])
  assert.notEqual(local.getItem(GUEST_CART_RECEIPT_KEY), null)
})

test('failed receipt creation prevents any network transfer', async () => {
  const local = storage()
  local.setItem = () => { throw new Error('Storage unavailable') }
  let transferred = false
  await assert.rejects(mergeGuestCart(local, async () => { transferred = true; return { acknowledged: true } }))
  assert.equal(transferred, false)
  assert.deepEqual(readGuestCart(local), [first, second])
})

test('malformed saved data is neither overwritten nor sent', async () => {
  for (const raw of ['{', '{}', 'null']) {
    const local = storage()
    local.data.set(GUEST_CART_KEY, raw)
    let transferred = false
    await assert.rejects(mergeGuestCart(local, async () => { transferred = true; return { acknowledged: true } }), /left unchanged/)
    assert.equal(transferred, false)
    assert.equal(local.getItem(GUEST_CART_KEY), raw)
  }
})

test('concurrent local changes during a transfer are never overwritten', async () => {
  const local = storage()
  const extra = { productId: 3, quantity: 1 }
  const result = await mergeGuestCart(local, async () => {
    local.setItem(GUEST_CART_KEY, JSON.stringify([first, second, extra]))
    return { acknowledged: true }
  })
  assert.equal(result.uncertain, true)
  assert.deepEqual(readGuestCart(local), [first, second, extra])
})

test('concurrent changes between checkpoints stop the next transfer without overwriting new data', async () => {
  const local = storage()
  const remove = local.removeItem
  const extra = { productId: 3, quantity: 1 }
  local.removeItem = key => {
    remove(key)
    if (key === GUEST_CART_RECEIPT_KEY) local.setItem(GUEST_CART_KEY, JSON.stringify([second, extra]))
  }
  let sent = 0
  const result = await mergeGuestCart(local, async () => { sent++; return { acknowledged: true } })
  assert.equal(sent, 1)
  assert.equal(result.migrated, 1)
  assert.deepEqual(readGuestCart(local), [second, extra])
})

test('session changes stop remaining transfers without discarding items', async () => {
  const local = storage()
  let sameSession = true
  const result = await mergeGuestCart(local, async () => {
    sameSession = false
    return { acknowledged: true }
  }, () => sameSession)
  assert.equal(result.migrated, 1)
  assert.deepEqual(result.pending, [second])
  assert.match(result.message, /session changed/)
})

test('removing a saved copy requires a matching snapshot and clears receipts only when empty', () => {
  const local = storage()
  local.setItem(GUEST_CART_RECEIPT_KEY, 'unconfirmed')
  assert.throws(() => removeSavedGuestItem(local, 0, second), /changed/)
  assert.deepEqual(readGuestCart(local), [first, second])
  assert.deepEqual(removeSavedGuestItem(local, 0, first), [second])
  assert.notEqual(local.getItem(GUEST_CART_RECEIPT_KEY), null)
  assert.deepEqual(removeSavedGuestItem(local, 0, second), [])
  assert.equal(local.getItem(GUEST_CART_RECEIPT_KEY), null)
})

test('guest line matching protects against changed quantity, variant, and specification order', () => {
  const displayed = { ...first, specs: { Color: 'Blue', Size: 'Small' } }
  assert.equal(guestLineMatches({ ...first, specs: JSON.stringify({ Size: 'Small', Color: 'Blue' }) }, displayed), true)
  assert.equal(guestLineMatches({ ...first, quantity: 3 }, displayed), false)
  assert.equal(guestLineMatches({ ...first, skuId: 99 }, displayed), false)
  assert.equal(guestLineMatches({ ...first, specs: { Size: 'Large', Color: 'Blue' } }, displayed), false)
})

test('application guest-cart locks serialize work and recover after rejection', async () => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const events = []
  const firstWork = withGuestCartLock(async () => { events.push('first'); await gate; throw new Error('Expected') })
  const expectedFailure = assert.rejects(firstWork, /Expected/)
  const secondWork = withGuestCartLock(() => { events.push('second'); return 'done' })
  await Promise.resolve()
  assert.deepEqual(events, ['first'])
  release()
  await expectedFailure
  assert.equal(await secondWork, 'done')
  assert.deepEqual(events, ['first', 'second'])
})
