const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')

test('ads listing requires a verified current admin before including inactive banners', async () => {
  const queries = []
  const db = {
    user: { findUnique: async ({ where }) => ({ id: where.id, userType: where.id === 1 ? 'customer' : 'admin', isActive: true, sessionVersion: 0 }) },
    adBanner: { findMany: async args => { queries.push(args); return [] } },
  }
  const auth = { verifyToken: token => token === 'invalid' ? null : { userId: token === 'admin' ? 2 : 1, userType: 'admin' } }
  const route = loadTypescript('src/app/api/ads/route.ts', {
    '@/lib/db': db, './db': db, '@/lib/auth': auth, './auth': auth,
    '@/lib/encryption': { encrypt: value => value },
  })
  const req = token => new Request('http://localhost/api/ads?position=all', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  assert.equal((await route.GET(req('invalid'))).status, 401)
  assert.equal((await route.GET(req('customer'))).status, 403)
  assert.equal(queries.length, 0)
  const publicResponse = await route.GET(req())
  assert.equal(publicResponse.status, 200)
  assert.equal(queries[0].where.isActive, true)
  const adminResponse = await route.GET(req('admin'))
  assert.equal(adminResponse.status, 200)
  assert.equal(adminResponse.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual(queries[1].where, {})
})

function shippingFixture(failCreate = false) {
  let active = true
  let transactions = 0
  const fee = {
    updateMany: async () => { active = false },
    create: async ({ data }) => {
      if (failCreate) throw new Error('Simulated create failure')
      active = true
      return data
    },
  }
  const db = {
    user: { findUnique: async () => ({ id: 1, userType: 'admin', isActive: true, sessionVersion: 0 }) },
    $transaction: async work => {
      transactions++
      const before = active
      try { return await work({ shippingFee: fee }) }
      catch (error) { active = before; throw error }
    },
  }
  const auth = { verifyToken: () => ({ userId: 1, sessionVersion: 0 }) }
  return {
    route: loadTypescript('src/app/api/shipping/route.ts', {
      '@/lib/db': db, './db': db, '@/lib/auth': auth, './auth': auth,
      '@/lib/encryption': { encryptData: value => value },
    }),
    active: () => active, transactions: () => transactions,
  }
}

const shippingRequest = body => new Request('http://localhost/api/shipping', {
  method: 'POST', headers: { Authorization: 'Bearer valid' }, body: JSON.stringify(body),
})

test('invalid shipping values never start replacement transactions', async () => {
  const f = shippingFixture()
  for (const body of [{ type: 'fixed', value: -1 }, { type: 'fixed', value: null },
    { type: 'percentage', value: 101 }, { type: 'unknown', value: 10 }, { type: 'fixed', value: 'Infinity' }]) {
    assert.equal((await f.route.POST(shippingRequest(body))).status, 400)
  }
  assert.equal(f.transactions(), 0)
  assert.equal(f.active(), true)
  const response = await f.route.POST(shippingRequest({ type: 'Standard', value: 0 }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).data.value, 0)
})

test('shipping create failure rolls back deactivation in the transaction substitute', async () => {
  const f = shippingFixture(true)
  assert.equal((await f.route.POST(shippingRequest({ type: 'fixed', value: 20 }))).status, 500)
  assert.equal(f.transactions(), 1)
  assert.equal(f.active(), true)
})
