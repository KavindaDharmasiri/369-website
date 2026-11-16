const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')

function request(body, token = 'valid') {
  return new Request('http://localhost/api/test', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
function fixture() {
  const calls = []
  const db = {
    user: { findUnique: async () => ({ id: 1, userType: 'customer', isActive: true, sessionVersion: 0 }) },
    coupon: { findUnique: async () => { calls.push('coupon'); return null } },
    order: { findFirst: async args => {
      calls.push(args)
      return { id: 1, orderItems: [{ id: 1, product: { prodImg: '/image.png' }, sku: { images: '[]', skuCode: 'SIZE-S' } }] }
    } },
  }
  const mocks = {
    '@/lib/db': db,
    '@/lib/auth': { verifyToken: token => token === 'valid' ? { userId: 1, userType: 'customer' } : null },
    '@/lib/encryption': { encryptData: data => data },
  }
  mocks['./db'] = db
  mocks['./auth'] = mocks['@/lib/auth']
  return { calls, load: file => loadTypescript(file, mocks) }
}

test('coupon preview rejects invalid token before accessing the database', async () => {
  const f = fixture()
  assert.equal((await f.load('src/app/api/coupons/validate/route.ts').POST(request({ code: 'SAVE', subtotal: 10 }, 'invalid'))).status, 401)
  assert.equal(f.calls.length, 0)
})

test('coupon preview rejects malformed subtotals and non-string codes', async () => {
  const f = fixture()
  const route = f.load('src/app/api/coupons/validate/route.ts')
  for (const subtotal of [-1, null, '10', 'Infinity']) assert.equal((await route.POST(request({ code: 'SAVE', subtotal }))).status, 400)
  assert.equal((await route.POST(request({ code: {}, subtotal: 10 }))).status, 400)
  assert.equal(f.calls.length, 0)
})

test('order detail rejects invalid tokens and malformed IDs before query work', async () => {
  const f = fixture()
  const route = f.load('src/app/api/orders/[id]/route.ts')
  assert.equal((await route.GET(request({}, 'invalid'), { params: { id: '1' } })).status, 401)
  assert.equal((await route.PATCH(request({}, 'invalid'), { params: { id: '1' } })).status, 401)
  assert.equal((await route.GET(request({}), { params: { id: '-1' } })).status, 400)
  assert.equal((await route.GET(request({}), { params: { id: '1junk' } })).status, 400)
  assert.equal(f.calls.length, 0)
})

test('customer order detail stays owner-scoped, selects SKU code, and is never publicly cached', async () => {
  const f = fixture()
  const response = await f.load('src/app/api/orders/[id]/route.ts').GET(request({}), { params: { id: '1' } })
  assert.equal(response.status, 200)
  assert.deepEqual(f.calls[0].where, { id: 1, userId: 1 })
  assert.equal(f.calls[0].include.orderItems.include.sku.select.skuCode, true)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal((await response.json()).data.orderItems[0].skuCode, 'SIZE-S')
})
