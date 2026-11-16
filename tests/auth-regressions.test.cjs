const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { loadTypescript } = require('./load-typescript.cjs')

function fixture({ tokenVersion = 0, version = 0, active = true, failure = false, legacyDb = false, versionless = false } = {}) {
  let writes = 0
  const token = { userId: 1, userType: 'admin', ...(!versionless ? { sessionVersion: tokenVersion } : {}) }
  const db = { user: {
    findUnique: async ({ select }) => {
      if (failure) throw new Error('Database offline')
      if (legacyDb && select.sessionVersion) throw Object.assign(new Error('users.session_version missing'), { code: 'P2022' })
      return { id: 1, email: 'test@example.invalid', userType: 'customer', isActive: active,
        ...(!legacyDb ? { sessionVersion: version } : {}) }
    },
    update: async () => { writes++; return { id: 1 } },
  } }
  const auth = { verifyToken: () => token }
  const mocks = { '@/lib/db': db, './db': db, '@/lib/auth': auth, './auth': auth,
    '@/lib/encryption': { encrypt: value => value } }
  return { load: file => loadTypescript(file, mocks), writes: () => writes }
}

const request = () => new Request('http://localhost/api/profile', {
  method: 'PUT', headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' },
  body: JSON.stringify({ firstName: 'Test' }),
})

test('profile fails closed on authentication DB failure without updating profile', async () => {
  const f = fixture({ failure: true })
  const response = await f.load('src/app/api/profile/route.ts').PUT(request())
  assert.equal(response.status, 401)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(f.writes(), 0)
})

test('profile rejects inactive and revoked sessions before writes', async () => {
  for (const options of [{ active: false }, { version: 1 }, { tokenVersion: '0' }, { tokenVersion: -1 }]) {
    const f = fixture(options)
    assert.equal((await f.load('src/app/api/profile/route.ts').PUT(request())).status, 401)
    assert.equal(f.writes(), 0)
  }
})

test('versionless tokens cannot bypass a revocation bump', async () => {
  const f = fixture({ version: 1, versionless: true })
  assert.equal((await f.load('src/app/api/profile/route.ts').PUT(request())).status, 401)
  assert.equal(f.writes(), 0)
})

test('profile permits valid sessions and pre-session-version DBs', async () => {
  for (const options of [{}, { legacyDb: true }, { versionless: true }]) {
    const f = fixture(options)
    assert.equal((await f.load('src/app/api/profile/route.ts').PUT(request())).status, 200)
    assert.equal(f.writes(), 1)
  }
})

test('admin authorization uses current DB role rather than JWT role', async () => {
  const f = fixture()
  let called = false
  const response = await f.load('src/lib/apiMiddleware.ts').requireAdmin(() => { called = true })(request())
  assert.equal(response.status, 403)
  assert.equal(called, false)
})

test('batch merge rejects missing durable identity before cart writes', async () => {
  const f = fixture()
  const response = await f.load('src/app/api/cart/merge/route.ts').POST(request())
  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'CART_NOT_MERGED')
  assert.equal(f.writes(), 0)
})

test('auth pages do not auto-import or erase saved bags and uncertain receipts', () => {
  for (const file of ['src/app/signin/page.tsx', 'src/app/signup/page.tsx']) {
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /\/api\/cart\/merge|removeItem\(GUEST_CART|removeItem\(['"]cart['"]\)/)
  }
})

test('admin combined activation/revocation never silently falls back to activation alone', async () => {
  let attempts = 0
  let audits = 0
  const route = loadTypescript('src/app/api/admin/users/[id]/route.ts', {
    '@/lib/apiMiddleware': { requireAdmin: handler => (req, context) => handler(req, { userId: 1 }, context) },
    '@/lib/db': { user: { update: async () => {
      attempts++
      throw Object.assign(new Error('session_version missing'), { code: 'P2022' })
    } } },
    '@/lib/audit': { recordAudit: async () => { audits++ } },
  })
  const req = new Request('http://localhost/api/admin/users/2', { method: 'PATCH',
    body: JSON.stringify({ isActive: true, revokeSessions: true }) })
  assert.equal((await route.PATCH(req, { params: { id: '2' } })).status, 409)
  assert.equal(attempts, 1)
  assert.equal(audits, 0)
})

test('sensitive entry points reject inactive, revoked, and unverifiable sessions before data access', async () => {
  const endpoints = [
    ['src/app/api/orders/route.ts', 'GET', undefined],
    ['src/app/api/orders/route.ts', 'POST', undefined],
    ['src/app/api/orders/[id]/route.ts', 'GET', { params: { id: '1' } }],
    ['src/app/api/orders/[id]/route.ts', 'PATCH', { params: { id: '1' } }],
    ['src/app/api/orders/[id]/pdf/route.ts', 'GET', { params: { id: '1' } }],
    ['src/app/api/orders/requests/[key]/route.ts', 'POST', { params: { key: 'order-request-test' } }],
    ['src/app/api/cart/route.ts', 'GET'],
    ['src/app/api/cart/route.ts', 'POST'],
    ['src/app/api/cart/[id]/route.ts', 'PATCH', { params: { id: '1' } }],
    ['src/app/api/cart/[id]/route.ts', 'DELETE', { params: { id: '1' } }],
    ['src/app/api/wishlist/route.ts', 'GET'],
    ['src/app/api/wishlist/route.ts', 'POST'],
    ['src/app/api/wishlist/route.ts', 'DELETE'],
    ['src/app/api/addresses/route.ts', 'GET'],
    ['src/app/api/addresses/route.ts', 'POST'],
    ['src/app/api/coupons/validate/route.ts', 'POST'],
    ['src/app/api/notifications/route.ts', 'GET'],
    ['src/app/api/notifications/route.ts', 'PATCH'],
    ['src/app/api/ads/route.ts', 'GET'],
    ['src/app/api/ads/route.ts', 'POST'],
    ['src/app/api/ads/[id]/route.ts', 'PUT', { params: { id: '1' } }],
    ['src/app/api/ads/[id]/route.ts', 'DELETE', { params: { id: '1' } }],
    ['src/app/api/categories/[id]/route.ts', 'GET', { params: { id: '1' } }],
    ['src/app/api/categories/[id]/route.ts', 'PUT', { params: { id: '1' } }],
    ['src/app/api/categories/[id]/route.ts', 'DELETE', { params: { id: '1' } }],
    ['src/app/api/subcategories/[id]/route.ts', 'GET', { params: { id: '1' } }],
    ['src/app/api/subcategories/[id]/route.ts', 'PUT', { params: { id: '1' } }],
    ['src/app/api/subcategories/[id]/route.ts', 'DELETE', { params: { id: '1' } }],
    ['src/app/api/audit/route.ts', 'GET'],
    ['src/app/api/settings/route.ts', 'PUT'],
    ['src/app/api/shipping/route.ts', 'POST'],
    ['src/app/api/products/[id]/reviews/route.ts', 'POST', { params: { id: '1' } }],
  ]
  for (const options of [{ active: false }, { version: 1 }, { failure: true }, { versionless: true, version: 1 }]) {
    for (const [file, method, context] of endpoints) {
      const f = fixture(options)
      const response = await f.load(file)[method](request(), context)
      assert.equal(response.status, 401, `${file} ${method}: ${JSON.stringify(options)}`)
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
      assert.equal(f.writes(), 0)
    }
  }
})

test('stale JWT admin claims cannot read other users orders or change status', async () => {
  const queries = []
  const db = {
    user: { findUnique: async () => ({ id: 1, isActive: true, userType: 'customer', sessionVersion: 0 }) },
    order: {
      findMany: async args => { queries.push(args.where); return [] },
      findFirst: async args => { queries.push(args.where); return { id: 1, orderItems: [] } },
      update: async () => { throw new Error('Must not write') },
    },
  }
  const auth = { verifyToken: () => ({ userId: 1, userType: 'admin', sessionVersion: 0 }) }
  const mocks = { '@/lib/db': db, './db': db, '@/lib/auth': auth, './auth': auth,
    '@/lib/notify': {}, '@/lib/encryption': {} }
  const list = loadTypescript('src/app/api/orders/route.ts', mocks)
  const detail = loadTypescript('src/app/api/orders/[id]/route.ts', mocks)
  assert.equal((await list.GET(request())).status, 200)
  assert.equal((await detail.GET(request(), { params: { id: '1' } })).status, 200)
  assert.equal((await detail.PATCH(request(), { params: { id: '1' } })).status, 403)
  assert.deepEqual(queries, [{ userId: 1 }, { id: 1, userId: 1 }])
})
