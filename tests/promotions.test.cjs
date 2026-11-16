const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Prisma } = require('@prisma/client')
const { loadTypescript } = require('./load-typescript.cjs')

const helpers = loadTypescript('src/lib/promotions.ts')
const discounts = loadTypescript('src/lib/discounts.ts')
const coupons = loadTypescript('src/lib/coupons.ts')
const existingDiscount = {
  id: 1, name: 'Offer', discountType: 'percentage', discountValue: new Prisma.Decimal(10),
  scope: 'product', productId: 1, categoryId: null, subCategoryId: null, isActive: true,
  validFrom: null, validUntil: null, description: null,
}
const existingCoupon = {
  id: 1, code: 'SAVE', discountType: 'percentage', discountValue: new Prisma.Decimal(10),
  minSubtotal: new Prisma.Decimal(100), maxDiscount: new Prisma.Decimal(20), maxUses: 5,
  usedCount: 0, isActive: true, validFrom: null, validUntil: null,
}
const adminWrapper = { requireAdmin: handler => (req, context) => handler(req, { userId: 1, userType: 'admin' }, context) }
function request(body) {
  return new Request('http://localhost/api/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

test('discount PATCH validates the effective existing percentage type', () => {
  assert.throws(() => helpers.discountData({ discountValue: 150 }, existingDiscount), /at most 100/)
  assert.throws(() => helpers.discountData({ discountType: 'percentage' }, { ...existingDiscount, discountType: 'fixed', discountValue: 150 }), /at most 100/)
})

test('discount PATCH supports target-only updates and clears obsolete scope IDs', () => {
  assert.equal(helpers.discountData({ productId: 2 }, existingDiscount).productId, 2)
  const moved = helpers.discountData({ scope: 'category', categoryId: 3 }, existingDiscount)
  assert.equal(moved.productId, null)
  assert.equal(moved.subCategoryId, null)
  assert.equal(moved.categoryId, 3)
  assert.throws(() => helpers.discountData({ scope: 'unknown' }, existingDiscount), /scope/)
  assert.throws(() => helpers.discountData({ scope: 'category' }, existingDiscount), /ID/)
})

test('promotion bounds, codes, dates and optional numeric fields are validated', () => {
  for (const discountValue of [-1, 0, 'Infinity', 'NaN', '', null, true, '10junk']) {
    assert.throws(() => helpers.couponData({ code: 'SAVE', discountValue }))
  }
  assert.throws(() => helpers.couponData({ code: ' ', discountValue: 10 }))
  assert.throws(() => helpers.couponData({ code: 'SAVE', discountValue: 10, maxUses: 1.5 }))
  assert.throws(() => helpers.couponData({ code: 'SAVE', discountValue: 10, maxDiscount: -1 }))
  assert.throws(() => helpers.couponData({ code: 'SAVE', discountValue: 10, validFrom: 'not a date' }))
  assert.throws(() => helpers.couponData({ validFrom: '2027-02-01', validUntil: '2027-01-01' }, existingCoupon))
  assert.throws(() => helpers.couponData({ validUntil: '2027-01-01' }, { ...existingCoupon, validFrom: new Date('2027-02-01') }))
  const data = helpers.couponData({ code: ' save ', maxDiscount: '', maxUses: null }, existingCoupon)
  assert.equal(data.code, 'SAVE')
  assert.equal(data.minSubtotal, 100)
  assert.equal(data.maxDiscount, null)
  assert.equal(data.maxUses, null)
})

test('legacy malformed discounts do not create negative prices, surcharges or NaN', () => {
  for (const discount of [
    { discountType: 'percentage', discountValue: 150 }, { discountType: 'fixed', discountValue: -10 },
    { discountType: 'fixed', discountValue: NaN }, { discountType: 'unknown', discountValue: 10 },
  ]) assert.equal(discounts.computeSalePrice(100, discount), 100)
  assert.equal(discounts.computeSalePrice(100, { discountType: 'fixed', discountValue: 200 }), 0)
  assert.equal(discounts.computeSalePrice(99.99, { discountType: 'percentage', discountValue: 10 }), 89.99)
})

test('best discount compares against actual SKU price while retaining scope precedence', () => {
  const product = { id: 1, prodPrice: 100, categoryId: 1, subCategoryId: 1 }
  const fixed = { scope: 'product', productId: 1, discountType: 'fixed', discountValue: 20 }
  const percentage = { scope: 'product', productId: 1, discountType: 'percentage', discountValue: 10 }
  assert.equal(discounts.bestDiscountForProduct([fixed, percentage], product), fixed)
  assert.equal(discounts.bestDiscountForProduct([fixed, percentage], product, 1000), percentage)
  const category = { scope: 'category', categoryId: 1, discountType: 'percentage', discountValue: 90 }
  assert.equal(discounts.bestDiscountForProduct([fixed, category], product), fixed)
})

test('legacy negative or over-100-percent coupons and invalid subtotals are rejected', async () => {
  for (const patch of [{ discountValue: -10 }, { discountValue: 150 }, { maxDiscount: -1 }, { maxUses: -1 }]) {
    const result = await coupons.validateCoupon({ coupon: { findUnique: async () => ({ ...existingCoupon, ...patch }) } }, 'SAVE', 100)
    assert.equal(result.valid, false)
  }
  const db = { coupon: { findUnique: async () => existingCoupon } }
  assert.equal((await coupons.validateCoupon(db, 'SAVE', -100)).valid, false)
  assert.equal((await coupons.validateCoupon(db, 'SAVE', NaN)).valid, false)
})

test('zero coupon cap means zero discount and zero usage means no redemptions', async () => {
  const capped = await coupons.validateCoupon({ coupon: { findUnique: async () => ({ ...existingCoupon, maxDiscount: 0 }) } }, 'SAVE', 100)
  assert.equal(capped.valid, true)
  assert.equal(capped.discount, 0)
  const exhausted = await coupons.validateCoupon({ coupon: { findUnique: async () => ({ ...existingCoupon, maxUses: 0 }) } }, 'SAVE', 100)
  assert.equal(exhausted.valid, false)
})

test('discount route blocks partial percentage bypass and persists target-only changes', async () => {
  const writes = []
  const db = {
    discount: { findUnique: async () => existingDiscount, update: async ({ data }) => { writes.push(data); return data } },
    product: { findUnique: async () => ({ id: 2 }) },
  }
  const route = loadTypescript('src/app/api/admin/discounts/[id]/route.ts', { '@/lib/db': db, '@/lib/apiMiddleware': adminWrapper })
  assert.equal((await route.PATCH(request({ discountValue: 150 }), { params: { id: '1' } })).status, 400)
  assert.equal(writes.length, 0)
  assert.equal((await route.PATCH(request({ productId: 2 }), { params: { id: '1' } })).status, 200)
  assert.equal(writes[0].productId, 2)
})

test('coupon create and update reject invalid values before any mutation', async () => {
  let writes = 0
  const db = { coupon: {
    findUnique: async () => existingCoupon,
    create: async () => { writes++; return {} },
    update: async () => { writes++; return {} },
  } }
  const mocks = { '@/lib/db': db, '@/lib/apiMiddleware': adminWrapper }
  const create = loadTypescript('src/app/api/admin/coupons/route.ts', mocks)
  const update = loadTypescript('src/app/api/admin/coupons/[id]/route.ts', mocks)
  assert.equal((await create.POST(request({ code: 'SAVE', discountValue: -10 }))).status, 400)
  assert.equal((await create.POST(request({ code: 'SAVE', discountValue: 150 }))).status, 400)
  assert.equal((await update.PATCH(request({ discountValue: 150 }), { params: { id: '1' } })).status, 400)
  assert.equal((await update.PATCH(request({ validFrom: 'bad' }), { params: { id: '1' } })).status, 400)
  assert.equal(writes, 0)
})

test('coupon and discount creation apply validated default types/scopes', async () => {
  const db = {
    coupon: { findUnique: async () => null, create: async ({ data }) => data },
    discount: { create: async ({ data }) => data },
    product: { findUnique: async () => ({ id: 1 }) },
  }
  const mocks = { '@/lib/db': db, '@/lib/apiMiddleware': adminWrapper }
  const couponRoute = loadTypescript('src/app/api/admin/coupons/route.ts', mocks)
  const couponResponse = await couponRoute.POST(request({ code: ' save ', discountValue: 10 }))
  assert.equal(couponResponse.status, 201)
  assert.equal((await couponResponse.json()).data.coupon.discountType, 'percentage')
  const discountRoute = loadTypescript('src/app/api/admin/discounts/route.ts', mocks)
  const discountResponse = await discountRoute.POST(request({ name: 'Offer', productId: 1, discountValue: 10 }))
  assert.equal(discountResponse.status, 201)
  const discount = (await discountResponse.json()).data.discount
  assert.equal(discount.scope, 'product')
  assert.equal(discount.discountType, 'percentage')
})
