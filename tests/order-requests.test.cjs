const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')
const helpers = loadTypescript('src/lib/orderRequests.ts')
const { runOrderRequest, settleOrderRequest, fingerprintOrderInput } = helpers

const input = {
  email: 'test@example.invalid', firstName: 'Test', lastName: 'Customer', address: 'Street', apartment: '',
  city: 'City', state: 'Region', zipCode: '00000', phone: '0000000000', paymentMethod: 'cash',
  items: [{ productId: 1, skuId: 1, quantity: 1 }],
}
const key = 'checkout-request-0001'
const hash = fingerprintOrderInput(input)
const order = (id = 1) => ({ id, orderNumber: `ORDER-${id}`, status: 'PENDING', total: 100 })
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

// Explicit UNIQUE-insert/transaction double. These tests exercise application
// arbitration, not PostgreSQL locking, isolation, query engines or network faults.
function identityDatabase() {
  const committed = new Map(), active = new Map(), events = []
  const waiting = deferred()
  let nextId = 1
  const scope = (userId, key) => `${userId}:${key}`
  const db = {
    committed, events, waiting, scope,
    orderRequest: { findUnique: async ({ where }) => {
      events.push('read')
      return structuredClone(committed.get(scope(where.userId_key.userId, where.userId_key.key)) || null)
    } },
    $transaction: async callback => {
      let ownedScope, ownedLock, row
      const tx = { orderRequest: {
        create: async ({ data }) => {
          const identity = scope(data.userId, data.key)
          while (active.has(identity)) {
            events.push('wait-for-unique')
            waiting.resolve()
            await active.get(identity).promise
          }
          if (committed.has(identity)) throw Object.assign(new Error('Unique constraint'), { code: 'P2002' })
          ownedScope = identity
          ownedLock = deferred()
          active.set(identity, ownedLock)
          events.push('claim')
          row = { id: nextId++, orderId: null, response: null, ...data }
          return structuredClone(row)
        },
        update: async ({ where, data }) => {
          assert.equal(where.id, row.id)
          Object.assign(row, data)
          events.push('complete')
          return structuredClone(row)
        },
      } }
      try {
        const result = await callback(tx)
        if (row) committed.set(ownedScope, structuredClone(row))
        return result
      } finally {
        if (ownedLock) { active.delete(ownedScope); ownedLock.resolve() }
      }
    },
  }
  return db
}

test('successful receipt replays the original response without rerunning order work', async () => {
  const db = identityDatabase()
  let writes = 0
  const create = async () => { writes++; return order() }
  const first = await runOrderRequest(db, 1, key, hash, create)
  const replay = await runOrderRequest(db, 1, key, hash, async () => { throw new Error('Stock must not be rechecked') })
  assert.equal(first.replayed, false)
  assert.equal(replay.replayed, true)
  assert.deepEqual(replay.response, first.response)
  assert.equal(writes, 1)
  assert.equal(db.committed.size, 1)
  assert.equal(db.events.filter(event => event === 'claim').length, 1)
})

test('same user/key with a different payload conflicts; different users are isolated', async () => {
  const db = identityDatabase()
  await runOrderRequest(db, 1, key, hash, async () => order())
  const changed = fingerprintOrderInput({ ...input, address: 'Other street' })
  await assert.rejects(runOrderRequest(db, 1, key, changed, async () => order(2)), error => error.code === 'IDEMPOTENCY_CONFLICT' && error.status === 409)
  assert.equal((await runOrderRequest(db, 2, key, changed, async () => order(2))).replayed, false)
  assert.equal(db.committed.size, 2)
})

test('simultaneous first requests arbitrate identity before invoking the second order callback', { timeout: 2000 }, async () => {
  const db = identityDatabase(), entered = deferred(), release = deferred()
  let writes = 0
  const first = runOrderRequest(db, 1, key, hash, async () => { writes++; entered.resolve(); await release.promise; return order() })
  await entered.promise
  const second = runOrderRequest(db, 1, key, hash, async () => { writes++; return order(2) })
  await db.waiting.promise
  assert.equal(writes, 1)
  release.resolve()
  const responses = await Promise.all([first, second])
  assert.deepEqual(responses[0].response, responses[1].response)
  assert.equal(responses[1].replayed, true)
  assert.equal(writes, 1)
})

test('a waiting different-payload request conflicts after the winner commits', { timeout: 2000 }, async () => {
  const db = identityDatabase(), entered = deferred(), release = deferred()
  const first = runOrderRequest(db, 1, key, hash, async () => { entered.resolve(); await release.promise; return order() })
  await entered.promise
  const second = assert.rejects(runOrderRequest(db, 1, key, fingerprintOrderInput({ ...input, phone: '1111111111' }), async () => order(2)), error => error.code === 'IDEMPOTENCY_CONFLICT')
  await db.waiting.promise
  release.resolve()
  await first
  await second
  assert.equal(db.committed.size, 1)
})

test('rollback releases the receipt claim and permits a waiting successful transaction', { timeout: 2000 }, async () => {
  const db = identityDatabase(), entered = deferred(), release = deferred()
  const first = assert.rejects(runOrderRequest(db, 1, key, hash, async () => { entered.resolve(); await release.promise; throw new Error('Order failed') }), /Order failed/)
  await entered.promise
  const second = runOrderRequest(db, 1, key, hash, async () => order(2))
  await db.waiting.promise
  release.resolve()
  await first
  const success = await second
  assert.equal(success.replayed, false)
  assert.equal(success.response.orderId, 2)
  assert.equal(db.committed.size, 1)
})

test('an unrelated unique error is not misclassified as an idempotent success', async () => {
  const db = identityDatabase()
  const failure = Object.assign(new Error('Order-number unique failure'), { code: 'P2002' })
  await assert.rejects(runOrderRequest(db, 1, key, hash, async () => { throw failure }), error => error === failure)
  assert.equal(db.committed.size, 0)
})

test('incomplete committed receipt fails closed without creating a replacement order', async () => {
  const db = identityDatabase()
  db.committed.set(db.scope(1, key), { id: 1, userId: 1, key, requestHash: hash, response: null, orderId: null })
  await assert.rejects(runOrderRequest(db, 1, key, hash, async () => order()), error => error.code === 'ORDER_REQUEST_UNCONFIRMED')
  assert.equal(db.events.includes('claim'), false)
})

test('resolving a completed identity returns the order and never cancels it', async () => {
  const db = identityDatabase()
  await runOrderRequest(db, 1, key, hash, async () => order())
  const resolution = await settleOrderRequest(db, 1, key)
  assert.deepEqual(resolution, { state: 'completed', order: { orderId: 1, orderNumber: 'ORDER-1', status: 'PENDING' } })
  assert.equal(db.committed.size, 1)
})

test('retiring a missing identity prevents late creation and is itself repeatable', async () => {
  const db = identityDatabase()
  assert.deepEqual(await settleOrderRequest(db, 1, key), { state: 'abandoned' })
  assert.deepEqual(await settleOrderRequest(db, 1, key), { state: 'abandoned' })
  await assert.rejects(runOrderRequest(db, 1, key, hash, async () => order()), error => error.code === 'ORDER_REQUEST_ABANDONED')
  assert.equal(db.committed.size, 1)
})

test('resolution racing a committed in-flight order returns that order', { timeout: 2000 }, async () => {
  const db = identityDatabase(), entered = deferred(), release = deferred()
  const create = runOrderRequest(db, 1, key, hash, async () => { entered.resolve(); await release.promise; return order() })
  await entered.promise
  const resolve = settleOrderRequest(db, 1, key)
  await db.waiting.promise
  release.resolve()
  await create
  assert.equal((await resolve).state, 'completed')
  assert.equal(db.committed.size, 1)
})

test('resolution racing a rolled-back order safely retires the released identity', { timeout: 2000 }, async () => {
  const db = identityDatabase(), entered = deferred(), release = deferred()
  const create = assert.rejects(runOrderRequest(db, 1, key, hash, async () => { entered.resolve(); await release.promise; throw new Error('Rolled back') }), /Rolled back/)
  await entered.promise
  const resolve = settleOrderRequest(db, 1, key)
  await db.waiting.promise
  release.resolve()
  await create
  assert.deepEqual(await resolve, { state: 'abandoned' })
})

module.exports = { input }
