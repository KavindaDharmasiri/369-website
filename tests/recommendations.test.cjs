const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')

const rules = loadTypescript('src/lib/recommendations/rules.ts')
const scoring = loadTypescript('src/lib/recommendations/scoring.ts')

function baseCtx(overrides = {}) {
  return {
    pageType: 'product',
    productId: 10,
    categoryId: 2,
    cartCount: 0,
    activeMs: 0,
    scrollDepth: 0,
    repeatViewCount: 0,
    similarViewedCount: 0,
    previouslyViewedWithoutAction: false,
    unavailableSelection: false,
    inBudgetBrowsing: false,
    checkoutInactive: false,
    hasHistory: false,
    hasWishlist: false,
    isAuthenticated: false,
    personalizationEnabled: true,
    ...overrides,
  }
}

test('dwell rule triggers for active browsing without action and is configurable by threshold', () => {
  const rule = rules.DEFAULT_RULES.find(r => r.key === 'dwell_no_action')
  assert.ok(rule)
  assert.equal(rule.condition(baseCtx({ activeMs: 4999, scrollDepth: 20 })), false)
  assert.equal(rule.condition(baseCtx({ activeMs: 5000, scrollDepth: 10 })), true)
  assert.equal(rule.condition(baseCtx({ activeMs: 5000, scrollDepth: 10, pageType: 'cart' })), true)
})

test('repeat view, comparison, return, unavailable, budget and cart inactivity rules select helpful actions', () => {
  const byKey = Object.fromEntries(rules.DEFAULT_RULES.map(r => [r.key, r]))
  assert.equal(byKey.repeat_product_view.condition(baseCtx({ repeatViewCount: 2 })), false)
  assert.equal(byKey.repeat_product_view.condition(baseCtx({ repeatViewCount: 3 })), true)
  assert.equal(byKey.repeat_product_view.actionType, 'open_size_guide')

  assert.equal(byKey.similar_products_compare.condition(baseCtx({ similarViewedCount: 3 })), true)
  assert.equal(byKey.similar_products_compare.actionType, 'compare_products')

  assert.equal(byKey.returning_product.condition(baseCtx({ previouslyViewedWithoutAction: true, isAuthenticated: true })), true)
  // Guests get the suggestion too, with a sign-in CTA instead of the wishlist link.
  assert.equal(byKey.returning_product.condition(baseCtx({ previouslyViewedWithoutAction: true, isAuthenticated: false })), true)
  assert.equal(byKey.returning_product.build(baseCtx({ isAuthenticated: false })).ctaHref, '/signin')
  assert.equal(byKey.returning_product.build(baseCtx({ isAuthenticated: true })).ctaHref, '/customer/account/wishlist')

  assert.equal(byKey.unavailable_size.condition(baseCtx({ unavailableSelection: true })), true)
  assert.equal(byKey.budget_browsing.condition(baseCtx({ inBudgetBrowsing: true })), true)

  assert.equal(byKey.cart_inactivity.condition(baseCtx({ pageType: 'cart', checkoutInactive: true, cartCount: 2 })), true)
  assert.equal(byKey.cart_inactivity.actionType, 'continue_checkout')
})

test('rules define cooldowns and session limits for non-intrusive behavior', () => {
  const dwell = rules.DEFAULT_RULES.find(r => r.key === 'dwell_no_action')
  assert.ok(dwell.cooldownSeconds >= 60)
  assert.ok(dwell.maxPerSession <= 3)
  const cart = rules.DEFAULT_RULES.find(r => r.key === 'cart_inactivity')
  assert.ok(cart.cooldownSeconds >= 60)
  assert.ok(cart.maxPerSession <= 3)
})

test('weighted scoring ranks relevant, available products higher and is bounded', () => {
  const high = scoring.scoreProduct({ categoryMatch: 1, preferenceMatch: 0.8, sizeFit: 1, priceFit: 0.9, history: 0.7, purchase: 0.8, available: 1, session: 0.8 })
  const low = scoring.scoreProduct({ categoryMatch: 0.1, preferenceMatch: 0.1, sizeFit: 0.2, priceFit: 0.2, history: 0, purchase: 0, available: 0, session: 0.1 })
  assert.ok(high > low)
  assert.ok(high >= 0 && high <= 1)
  assert.ok(low >= 0 && low <= 1)

  const ranked = scoring.rankProducts([
    { id: 1, name: 'Low', price: 10, score: 0.2 },
    { id: 2, name: 'High', price: 30, score: 0.9 },
    { id: 3, name: 'Mid', price: 20, score: 0.5 },
  ], 2)
  assert.deepEqual(ranked.map(p => p.id), [2, 3])
})
