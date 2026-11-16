const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')
const { findSkuForSelection } = loadTypescript('src/lib/variants.ts')
const specs = [{ name: 'Size' }, { name: 'Color' }]
const smallBlue = { id: 1, isActive: true, variantKeys: 'Small, Blue' }
const skus = [smallBlue, { id: 2, isActive: false, variantKeys: 'Large, Blue' }]

test('variant lookup is independent of selection insertion order', () => {
  assert.equal(findSkuForSelection(skus, specs, { Color: 'Blue', Size: 'Small' }), smallBlue)
  assert.equal(findSkuForSelection(skus, specs, { Size: 'Small', Color: 'Blue' }), smallBlue)
})

test('partial, missing, inactive and unmatched variants clear the previous match', () => {
  assert.equal(findSkuForSelection(skus, specs, { Size: 'Small' }), null)
  assert.equal(findSkuForSelection(skus, specs, { Size: 'Large', Color: 'Blue' }), null)
  assert.equal(findSkuForSelection(skus, specs, { Size: 'Small', Color: 'Red' }), null)
  assert.equal(findSkuForSelection([], specs, { Size: 'Small', Color: 'Blue' }), null)
  assert.equal(findSkuForSelection(skus, [], {}), null)
})
