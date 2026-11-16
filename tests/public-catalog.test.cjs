const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')
const { listPublicProducts, listPublicCategories } = loadTypescript('src/lib/publicCatalog.ts')

test('public catalog explicitly selects old-schema-safe fields and enforces publication', async () => {
  const calls = []
  const db = { product: { findMany: async args => {
    calls.push(args)
    return [{ id: 1, prodPrice: { toJSON: () => '100', valueOf: () => 100 }, createdAt: new Date('2026-01-01') }]
  } }, discount: { findMany: async () => [] } }
  const rows = await listPublicProducts(db, { where: { isDeleted: true, category: {}, featuredOnHomepage: true } })
  assert.equal(calls[0].select.slug, undefined)
  assert.equal(calls[0].select.createdBy, undefined)
  assert.equal(calls[0].select.category.select.slug, undefined)
  assert.equal(calls[0].select.subCategory.select.slug, undefined)
  assert.equal(calls[0].where.isDeleted, false)
  assert.deepEqual(calls[0].where.category, { isActive: true })
  assert.deepEqual(calls[0].where.subCategory, { isActive: true })
  assert.equal(calls[0].where.stockStatus, undefined)
  assert.equal(rows[0].prodPrice, '100')
  assert.equal(typeof rows[0].createdAt, 'string')
})

test('public categories never implicitly select slug or unpublished content', async () => {
  await listPublicCategories({ category: { findMany: async args => {
    assert.deepEqual(args.where, { isActive: true })
    assert.equal(args.select.slug, undefined)
    return []
  } } })
})

test('public listing bounds are validated before DB reads', async () => {
  for (const limit of [-1, 0, 201, NaN, 1.5]) await assert.rejects(listPublicProducts({}, { limit }), /Invalid catalog limit/)
})

test('catalog APIs preserve encrypted response shape and return 503 on temporary DB outage', async () => {
  for (const file of ['src/app/api/products/featured/route.ts', 'src/app/api/products/new-arrivals/route.ts']) {
    const route = loadTypescript(file, {
      '@/lib/db': {}, '@/lib/encryption': { encrypt: value => value },
      '@/lib/publicCatalog': { listPublicProducts: async () => { throw new Error('private DB error') } },
    })
    const response = await route.GET()
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.doesNotMatch(JSON.stringify(await response.json()), /private DB error/)
  }
})

test('search rejects malformed limits and overlong queries before catalog access', async () => {
  let calls = 0
  const route = loadTypescript('src/app/api/products/search/route.ts', {
    '@/lib/db': {}, '@/lib/encryption': { encrypt: value => value },
    '@/lib/publicCatalog': { listPublicProducts: async () => { calls++; return [] } },
  })
  for (const query of ['q=shirt&limit=-1', 'q=shirt&limit=1junk', `q=${'x'.repeat(201)}`]) {
    assert.equal((await route.GET(new Request(`http://localhost/api/products/search?${query}`))).status, 400)
  }
  assert.equal(calls, 0)
  assert.equal((await route.GET(new Request('http://localhost/api/products/search?q=shirt'))).status, 200)
  assert.equal(calls, 1)
})
