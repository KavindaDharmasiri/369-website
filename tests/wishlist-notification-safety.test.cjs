const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')

function fixture({ wrongSku = false, hiddenProduct = false } = {}) {
  const calls = []
  const db = {
    product: { findUnique: async () => ({ id: 1, status: 'ACTIVE', prodMarket: hiddenProduct ? 'DRAFT' : 'MARKETPLACE',
      isDeleted: false, category: { isActive: true }, subCategory: { isActive: true } }) },
    productSku: { findUnique: async () => ({ productId: wrongSku ? 2 : 1, isActive: true }) },
    wishlistItem: {
      findFirst: async () => null,
      create: async args => { calls.push(args); return args.data },
      deleteMany: async args => { calls.push(args); return { count: 1 } },
    },
    notification: { updateMany: async args => { calls.push(args); return { count: 1 } } },
  }
  const mocks = {
    '@/lib/db': db,
    '@/lib/apiMiddleware': { loadActiveUser: async user => user },
    '@/lib/auth': { verifyToken: () => ({ userId: 5, userType: 'admin' }) },
    '@/lib/encryption': { encryptData: data => data },
  }
  return { calls, load: file => loadTypescript(file, mocks) }
}

function req(body = {}, url = 'http://localhost/api/test') {
  return new Request(url, { method: 'POST', headers: { Authorization: 'Bearer valid' }, body: JSON.stringify(body) })
}

test('wishlist malformed IDs cannot create or delete rows', async () => {
  const f = fixture()
  const route = f.load('src/app/api/wishlist/route.ts')
  for (const productId of [null, 0, -1, 1.5, '1junk', {}, []]) {
    assert.equal((await route.POST(req({ productId }))).status, 400)
  }
  for (const query of ['productId=1junk', 'productId=-1', 'productId=1&skuId=2junk']) {
    assert.equal((await route.DELETE(req({}, `http://localhost/api/wishlist?${query}`))).status, 400)
  }
  assert.equal(f.calls.length, 0)
})

test('wishlist rejects hidden products and mismatched SKUs without writes', async () => {
  for (const options of [{ wrongSku: true }, { hiddenProduct: true }]) {
    const f = fixture(options)
    assert.equal((await f.load('src/app/api/wishlist/route.ts').POST(req({ productId: 1, skuId: 2 }))).status, 404)
    assert.equal(f.calls.length, 0)
  }
})

test('wishlist deletion remains owner-scoped with exact validated IDs', async () => {
  const f = fixture()
  assert.equal((await f.load('src/app/api/wishlist/route.ts').DELETE(req({}, 'http://localhost/api/wishlist?productId=1&skuId=2'))).status, 200)
  assert.deepEqual(f.calls[0].where, { userId: 5, productId: 1, skuId: 2 })
})

test('malformed notification IDs never become mark-all requests', async () => {
  const f = fixture()
  const route = f.load('src/app/api/notifications/route.ts')
  for (const ids of [[], null, 'all', [0], ['1junk'], Array(101).fill(1)]) {
    assert.equal((await route.PATCH(req({ ids }))).status, 400)
  }
  assert.equal(f.calls.length, 0)
  assert.equal((await route.PATCH(req({ ids: [1, 2] }))).status, 200)
  assert.deepEqual(f.calls[0].where, { recipient: 'admin', id: { in: [1, 2] } })
  assert.equal((await route.PATCH(req({}))).status, 200)
  assert.deepEqual(f.calls[1].where, { recipient: 'admin', isRead: false })
})
