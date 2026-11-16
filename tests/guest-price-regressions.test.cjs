const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')

test('guest enrichment does not overwrite current product price with a local snapshot', async () => {
  const previous = global.fetch
  global.fetch = async () => Response.json({ data: { prodName: 'Current product', prodPrice: '100', salePrice: 80, originalPrice: 100, stockStatus: true } })
  try {
    const { enrichGuestCartItem } = loadTypescript('src/lib/cartEnrich.ts', {
      '@/lib/clientEncryption': { decryptData: value => value },
    })
    const item = await enrichGuestCartItem({ productId: 1, quantity: 1, price: 0, originalPrice: 9999 })
    assert.equal(item.price, 80)
    assert.equal(item.originalPrice, 100)
  } finally { global.fetch = previous }
})

test('guest enrichment uses live SKU sale price instead of saved variant prices', async () => {
  const previous = global.fetch
  global.fetch = async url => Response.json({ data: String(url).endsWith('/skus')
    ? [{ id: 2, price: 150, salePrice: 120, originalPrice: 150, stock: 3 }]
    : { prodName: 'Product', prodPrice: 100, stockStatus: true } })
  try {
    const { enrichGuestCartItem } = loadTypescript('src/lib/cartEnrich.ts', {
      '@/lib/clientEncryption': { decryptData: value => value },
    })
    const item = await enrichGuestCartItem({ productId: 1, skuId: 2, price: 1, originalPrice: 1 })
    assert.equal(item.price, 120)
    assert.equal(item.originalPrice, 150)
    assert.equal(item.stock, 3)
  } finally { global.fetch = previous }
})
