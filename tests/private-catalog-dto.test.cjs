const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')

for (const [route, model, key] of [
  ['cart', 'cartItem', 'cartItems'], ['wishlist', 'wishlistItem', 'wishlist'],
]) {
  function load(findMany) {
    return loadTypescript(`src/app/api/${route}/route.ts`, {
      '@/lib/db': { [model]: { findMany } },
      '@/lib/auth': { verifyToken: () => ({ userId: 7, userType: 'customer' }) },
      '@/lib/apiMiddleware': { loadActiveUser: async value => value },
      '@/lib/encryption': { encryptData: value => value },
      '@/lib/discounts': { getActiveDiscounts: async () => [], bestDiscountForProduct: () => null,
        buildDiscountInfo: price => ({ salePrice: price }) },
    })
  }

  test(`${route} selects an owner-scoped safe product DTO without internal actors/tags or slug probes`, async () => {
    let calls = 0
    const handler = load(async query => {
      calls++
      assert.deepEqual(query.where, { userId: 7 })
      const select = query.include.product.select
      for (const field of ['slug', 'createdBy', 'updatedBy', 'tagsGa4', 'tagsMeta', 'tagsCategory']) {
        assert.equal(select[field], undefined, field)
      }
      assert.equal(select.prodName, true)
      assert.equal(select.prodPrice, true)
      return [{ id: 1, product: { id: 3, prodName: 'Shirt', prodPrice: 3000 }, sku: null }]
    })
    const response = await handler.GET(new Request(`http://localhost/api/${route}`, {
      headers: { Authorization: 'Bearer test' },
    }))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    const body = await response.json()
    assert.equal(body.data[key][0].product.prodName, 'Shirt')
    assert.equal(calls, 1)
  })

  test(`${route} never retries a database failure with a wider product read`, async () => {
    let calls = 0
    const handler = load(async () => { calls++; throw Object.assign(new Error('private DB detail'), { code: 'P2022' }) })
    const response = await handler.GET(new Request(`http://localhost/api/${route}`, {
      headers: { Authorization: 'Bearer test' },
    }))
    assert.equal(response.status, 500)
    assert.equal(calls, 1)
    assert.doesNotMatch(await response.text(), /private DB detail/)
  })
}
