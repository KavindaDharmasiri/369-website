const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')
const { buildProductSchema, serializeJsonLd, selectionForSku, skuImageUrls } = loadTypescript('src/lib/productSeo.ts')
const { findPublicProduct, isPublicProduct } = loadTypescript('src/lib/publicProduct.ts')
const product = { id: 3, prodName: 'Cotton Tee', prodDescription: 'Real product description', prodPrice: 100,
  salePrice: 80, status: 'ACTIVE', prodMarket: 'MARKETPLACE', stockStatus: true, isDeleted: false,
  category: { isActive: true }, subCategoryId: 2, subCategory: { isActive: true } }
const canonical = 'https://shop.example/customer/product?id=3'
const specs = [{ name: 'Size' }, { name: 'Color' }]
const sku = { id: 8, isActive: true, skuCode: 'TEE-S-BLUE', variantKeys: 'Small, Blue', stock: 2, price: 100, salePrice: 80, images: '["https://images.example/blue.jpg"]' }

test('publication is separate from temporary stock and excludes hidden content', () => {
  assert.equal(isPublicProduct({ ...product, stockStatus: false }), true)
  for (const change of [{ isDeleted: true }, { status: 'INACTIVE' }, { prodMarket: 'DRAFT' },
    { category: { isActive: false } }, { subCategory: { isActive: false } }]) {
    assert.equal(isPublicProduct({ ...product, ...change }), false)
  }
})

test('numeric lookup explicitly selects rollout-safe fields without slug probes', async () => {
  let queries = 0
  const result = await findPublicProduct({ product: { findUnique: async args => {
    queries++
    assert.deepEqual(args.where, { id: 3 })
    assert.equal(args.include, undefined)
    assert.equal(args.select.slug, undefined)
    assert.equal(args.select.category.select.slug, undefined)
    assert.equal(args.select.subCategory.select.slug, undefined)
    return product
  } } }, '3')
  assert.equal(result, product)
  assert.equal(queries, 1)
})

test('database outages propagate rather than becoming permanent missing products', async () => {
  const db = { product: { findUnique: async () => { throw new Error('offline') } } }
  await assert.rejects(findPublicProduct(db, '3'), /offline/)
})

test('SKU-less offers show actual sale price and truthful sold-out availability', () => {
  const schema = buildProductSchema({ ...product, stockStatus: false }, canonical, [], [], [])
  assert.equal(schema['@type'], 'Product')
  assert.equal(schema.offers.price, '80.00')
  assert.equal(schema.offers.availability, 'https://schema.org/OutOfStock')
  assert.equal(schema.offers.priceCurrency, 'LKR')
})

test('unknown inventory and invalid prices never fabricate in-stock or zero-price offers', () => {
  assert.equal(buildProductSchema(product, canonical, null, [], []).offers, undefined)
  for (const salePrice of [-1, 'NaN', null]) {
    const invalid = { ...product, salePrice, prodPrice: salePrice }
    assert.equal(buildProductSchema(invalid, canonical, [], [], []).offers, undefined)
  }
  assert.equal(buildProductSchema({ ...product, salePrice: 0 }, canonical, [], [], []).offers.price, '0.00')
})

test('ProductGroup contains active variants with distinct selectable URLs and matching prices', () => {
  const schema = buildProductSchema(product, canonical, [sku, { ...sku, id: 9, stock: 0 }, { ...sku, id: 10, isActive: false }], specs, ['/base.jpg'])
  assert.equal(schema['@type'], 'ProductGroup')
  assert.equal(schema.hasVariant.length, 2)
  assert.deepEqual(schema.variesBy, ['https://schema.org/color', 'https://schema.org/size'])
  assert.equal(schema.hasVariant[0].size, 'Small')
  assert.equal(schema.hasVariant[0].color, 'Blue')
  assert.equal(new URL(schema.hasVariant[0].url).searchParams.get('sku'), '8')
  assert.equal(schema.hasVariant[0].offers.price, '80.00')
  assert.equal(schema.hasVariant[1].offers.availability, 'https://schema.org/OutOfStock')
  assert.equal(schema.offers, undefined)
})

test('deep-link selections use specification order and reject inactive/malformed variants', () => {
  assert.deepEqual(selectionForSku(sku, specs), { Size: 'Small', Color: 'Blue' })
  assert.equal(selectionForSku({ ...sku, isActive: false }, specs), null)
  assert.equal(selectionForSku({ ...sku, variantKeys: 'Small' }, specs), null)
  assert.deepEqual(skuImageUrls({ images: '{bad' }, ['/base.jpg']), ['/base.jpg'])
})

test('JSON-LD escapes script-breaking product content without corrupting the data', () => {
  const name = '</script><script>alert(1)</script>'
  const encoded = serializeJsonLd({ name })
  assert.equal(encoded.includes('<'), false)
  assert.equal(JSON.parse(encoded).name, name)
})

test('ratings are emitted only for a real nonempty valid public aggregate', () => {
  for (const reviews of [null, { averageRating: 5, reviewCount: 0 }, { averageRating: 9, reviewCount: 2 }]) {
    assert.equal(buildProductSchema(product, canonical, [], [], [], reviews).aggregateRating, undefined)
  }
  assert.equal(buildProductSchema(product, canonical, [], [], [], { averageRating: 4.5, reviewCount: 2 }).aggregateRating.reviewCount, 2)
})
