const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')

// ---------------------------------------------------------------------------
// In-memory catalogue + a tiny Prisma double (offline; no DB, no Next server).
// ---------------------------------------------------------------------------
const categories = [
  { id: 1, name: 'Women', isActive: true },
  { id: 2, name: 'Men', isActive: true },
]
const products = [
  // Women / Dresses (sub 10)
  { id: 101, prodName: 'Linen Midi Dress', categoryId: 1, subCategoryId: 10, prodPrice: 9000, featuredOnHomepage: true, showInNewArrivals: false },
  { id: 102, prodName: 'Silk Slip Dress', categoryId: 1, subCategoryId: 10, prodPrice: 9500, featuredOnHomepage: false, showInNewArrivals: true },
  { id: 103, prodName: 'Wrap Dress', categoryId: 1, subCategoryId: 10, prodPrice: 8800, featuredOnHomepage: false, showInNewArrivals: false },
  // Women / Tops (sub 11)
  { id: 104, prodName: 'Cotton Blouse', categoryId: 1, subCategoryId: 11, prodPrice: 4500, featuredOnHomepage: false, showInNewArrivals: true },
  { id: 105, prodName: 'Knit Cardigan', categoryId: 1, subCategoryId: 11, prodPrice: 6000, featuredOnHomepage: false, showInNewArrivals: false },
  // Men / Shirts (sub 20)
  { id: 201, prodName: 'Oxford Shirt', categoryId: 2, subCategoryId: 20, prodPrice: 5000, featuredOnHomepage: true, showInNewArrivals: false },
  { id: 202, prodName: 'Linen Shirt', categoryId: 2, subCategoryId: 20, prodPrice: 5200, featuredOnHomepage: false, showInNewArrivals: true },
  // Men / Trousers (sub 21)
  { id: 203, prodName: 'Chino Trousers', categoryId: 2, subCategoryId: 21, prodPrice: 6500, featuredOnHomepage: false, showInNewArrivals: false },
].map((p, i) => ({
  status: 'ACTIVE', prodMarket: 'MARKETPLACE', isDeleted: false, stockStatus: true, prodImg: `img${p.id}.jpg`,
  prodCategoryName: categories.find(c => c.id === p.categoryId).name, prodSubCategoryName: null, tagsCategory: null, prodSubtitle: null,
  createdAt: new Date(Date.UTC(2026, 0, 1 + i)), slug: null,
  category: categories.find(c => c.id === p.categoryId), ...p,
}))

function matchValue(value, cond) {
  if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
    if ('in' in cond || 'notIn' in cond || 'not' in cond || 'gte' in cond || 'lte' in cond) {
      if ('in' in cond && !cond.in.includes(value)) return false
      if ('notIn' in cond && cond.notIn.includes(value)) return false
      if ('not' in cond && value === cond.not) return false
      if ('gte' in cond && !(Number(value) >= Number(cond.gte))) return false
      if ('lte' in cond && !(Number(value) <= Number(cond.lte))) return false
      return true
    }
    if ('contains' in cond) return String(value || '').toLowerCase().includes(String(cond.contains).toLowerCase())
    if ('equals' in cond) return String(value || '').toLowerCase() === String(cond.equals).toLowerCase()
    return true // relation filters (category: { isActive }) — all fixtures are active
  }
  return value === cond
}
function matches(row, where = {}) {
  return Object.entries(where).every(([k, cond]) => {
    if (k === 'OR') return cond.some(w => matches(row, w))
    if (k === 'AND') return cond.every(w => matches(row, w))
    if (k === 'prodMarket') return true
    return matchValue(row[k], cond)
  })
}

function makeDb(state = {}) {
  const logs = state.logs || []
  const events = state.events || []
  let logId = 1000
  return {
    logs,
    userPreference: { findUnique: async () => state.preference || null },
    orderItem: {
      findMany: async () => state.purchases || [],
      groupBy: async () => (state.bestsellers || []).map(productId => ({ productId, _sum: { quantity: 5 } })),
    },
    wishlistItem: {
      findMany: async () => (state.wishlist || []).map(id => ({ productId: id, product: products.find(p => p.id === id) })),
      groupBy: async () => [],
    },
    cartItem: { findMany: async () => (state.cart || []).map(id => ({ productId: id, product: products.find(p => p.id === id) })) },
    engagementEvent: { findMany: async () => events },
    discount: { findMany: async () => [] },
    recommendationLog: {
      findMany: async () => [...logs].sort((a, b) => (b.createdAt - a.createdAt) || (b.id - a.id)),
      create: async ({ data }) => { const row = { id: ++logId, createdAt: new Date(), updatedAt: new Date(), ...data }; logs.push(row); return row },
    },
    category: {
      findUnique: async ({ where }) => categories.find(c => c.id === where.id) || null,
      findFirst: async ({ where }) => categories.find(c => matches(c, { name: where.name })) || null,
      findMany: async ({ where }) => categories.filter(c => matches(c, where)),
    },
    product: {
      findUnique: async ({ where }) => products.find(p => p.id === where.id) || null,
      findFirst: async ({ where }) => products.find(p => matches(p, where)) || null,
      findMany: async ({ where, take, skip }) => products.filter(p => matches(p, where)).slice(skip || 0, (skip || 0) + (take || 50)),
      count: async ({ where }) => products.filter(p => matches(p, where)).length,
    },
  }
}

function loadEngine(db) {
  delete globalThis.__suggestCatalog // fresh catalogue cache per scenario
  return loadTypescript('src/lib/recommendations/engine.ts', { '@/lib/db': { __esModule: true, default: db } })
}

const ACTIVE = { activeMs: 6000, scrollDepth: 0 }

// ---------------------------------------------------------------------------

test('page type detection gives each shopping page its own type', () => {
  const { detectPageType } = loadTypescript('src/lib/engagement/pageType.ts')
  const sp = (s) => new URLSearchParams(s)
  assert.equal(detectPageType('/', sp('')), 'home')
  assert.equal(detectPageType('/customer/shop', sp('')), 'shop')
  assert.equal(detectPageType('/customer/shop', sp('search=linen')), 'search')
  assert.equal(detectPageType('/customer/category', sp('type=women')), 'category')
  assert.equal(detectPageType('/customer/product', sp('id=12')), 'product')
  assert.equal(detectPageType('/customer/cart', sp('')), 'cart')
  assert.equal(detectPageType('/customer/account/wishlist', sp('')), 'wishlist')
  assert.equal(detectPageType('/customer/account/orders', sp('')), 'account')
  assert.equal(detectPageType('/admin/products', sp('')), 'admin')
  assert.equal(detectPageType('/signin', sp('')), 'auth')
})

test('guests get a different, page-relevant suggestion on every shopping page', async () => {
  const db = makeDb()
  const engine = loadEngine(db)
  const pages = [
    { pageType: 'home' },
    { pageType: 'shop' },
    { pageType: 'search', searchQuery: 'linen' },
    { pageType: 'category', categoryRef: 'men' },
    { pageType: 'product', productRef: '101' },
    { pageType: 'cart', cartProductIds: [201], cartCount: 1 },
  ]
  const results = []
  for (const page of pages) {
    const r = await engine.generateSuggestion({ sessionId: 'guest-1', userId: null, ...ACTIVE, ...page })
    assert.equal(r.enabled, true, `expected a suggestion on ${page.pageType}`)
    assert.ok(r.products.length > 0, `expected products on ${page.pageType}`)
    assert.equal(r.context.pageType, page.pageType)
    results.push(r)
  }
  // Every page has its own rule and its own highlight label.
  assert.equal(new Set(results.map(r => r.ruleKey)).size, pages.length)
  assert.equal(new Set(results.map(r => r.context.label)).size, pages.length)

  const [, , search, category, product, cart] = results
  assert.match(search.title, /linen/i)
  assert.ok(search.products.every(p => /linen/i.test(p.name)) || search.products[0].name.match(/linen/i))
  assert.equal(category.context.label, 'Men collection')
  const filler = p => ['Something different', 'You might also like'].includes(p.reason)
  assert.equal(category.products[0].categoryName, 'Men')
  assert.ok(category.products.filter(p => !filler(p)).every(p => p.categoryName === 'Men'))
  assert.match(product.title, /Linen Midi Dress/)
  assert.ok(!product.products.some(p => p.id === 101), 'current product is never suggested to itself')
  assert.ok(product.products.slice(0, 3).some(p => p.reason === 'Similar style'))
  assert.ok(product.products.slice(0, 3).every(p => p.categoryName === 'Women'), 'top picks stay in the product\'s category')
  // A bag with items is nudged to pay, with at most two small add-ons.
  assert.equal(cart.ruleKey, 'cart_checkout')
  assert.equal(cart.action, 'continue_checkout')
  assert.equal(cart.ctaHref, '#checkout')
  assert.ok(cart.products.length <= 2)
  assert.ok(!cart.products.some(p => p.id === 201), 'items already in the bag are excluded')
})

test('logged-in users get suggestions too, using their bag and wishlist from the database', async () => {
  const db = makeDb({ cart: [104], wishlist: [202] })
  const engine = loadEngine(db)
  const cart = await engine.generateSuggestion({ sessionId: 's-user', userId: 7, pageType: 'cart', ...ACTIVE })
  assert.equal(cart.enabled, true)
  assert.equal(cart.ruleKey, 'cart_checkout')
  assert.match(cart.title, /checkout/i)
  assert.ok(!cart.products.some(p => p.id === 104))

  const wish = await engine.generateSuggestion({ sessionId: 's-user', userId: 7, pageType: 'wishlist', ...ACTIVE })
  assert.equal(wish.enabled, true)
  assert.equal(wish.title, 'Inspired by your wishlist')
  assert.equal(wish.context.label, 'Your wishlist')
  assert.ok(!wish.products.some(p => p.id === 202))

  // With items in the bag, the account page first reminds about the bag, then gives normal picks.
  const account = await engine.generateSuggestion({ sessionId: 's-user', userId: 7, pageType: 'account', ...ACTIVE })
  assert.equal(account.ruleKey, 'bag_waiting')
  const account2 = await engine.generateSuggestion({ sessionId: 's-user', userId: 7, pageType: 'account', userRequested: true, ...ACTIVE })
  assert.equal(account2.ruleKey, 'account_picks')
})

test('a first product view is not treated as a returning view', async () => {
  const db = makeDb()
  const engine = loadEngine(db)
  const first = await engine.generateSuggestion({ sessionId: 'g2', pageType: 'product', productId: 102, productViewCount: 1, viewedProductIds: [102], ...ACTIVE })
  assert.equal(first.ruleKey, 'product_similar')
  const second = await engine.generateSuggestion({ sessionId: 'g3', pageType: 'product', productId: 102, productViewCount: 2, viewedProductIds: [102], ...ACTIVE })
  assert.equal(second.ruleKey, 'returning_product')
  assert.equal(second.ctaHref, '/signin')
})

test('suggestions are suppressed on admin, sign-in and checkout pages', async () => {
  const engine = loadEngine(makeDb())
  for (const pageType of ['admin', 'auth', 'checkout']) {
    const r = await engine.generateSuggestion({ sessionId: 'g4', pageType, ...ACTIVE })
    assert.equal(r.enabled, false)
  }
})

test('cooldowns are per page context, so a new product still gets its own suggestion', async () => {
  const db = makeDb()
  const engine = loadEngine(db)
  const a = await engine.generateSuggestion({ sessionId: 'g5', pageType: 'product', productId: 101, ...ACTIVE })
  const aAgain = await engine.generateSuggestion({ sessionId: 'g5', pageType: 'product', productId: 101, ...ACTIVE })
  const b = await engine.generateSuggestion({ sessionId: 'g5', pageType: 'product', productId: 201, ...ACTIVE })
  assert.equal(a.enabled, true)
  assert.equal(aAgain.enabled, false, 'same product is in cooldown')
  assert.equal(b.enabled, true, 'a different product is not blocked by the first one')
  assert.match(b.title, /Oxford Shirt/)
})

test('only Snooze pauses suggestions; closing with × never blocks future ones', async () => {
  const engine = loadEngine(makeDb())
  const now = Date.now()
  const dismissed = [{ ruleKey: 'product_similar', status: 'dismissed', context: { pageType: 'product', contextKey: 'product:101' }, createdAt: new Date(now - 1000), updatedAt: new Date(now - 1000) }]
  assert.equal(engine.isBlockedByUser(dismissed, 'product:101', now), false)
  const snoozed = [{ ruleKey: 'shop_picks', status: 'snoozed', snoozedUntil: new Date(now + 60000), context: { pageType: 'shop', contextKey: 'shop' }, createdAt: new Date(now) }]
  assert.equal(engine.isBlockedByUser(snoozed, 'product:101', now), true)
})

test('staying on one page keeps offering fresh ideas without a refresh', async () => {
  const db = makeDb({ bestsellers: [101, 201, 104, 203] })
  const engine = loadEngine(db)
  const first = await engine.generateSuggestion({ sessionId: 'stay', pageType: 'home', ...ACTIVE })
  assert.equal(first.enabled, true)
  // "More ideas" right away: cooldown is skipped and the set is different.
  const more = await engine.generateSuggestion({ sessionId: 'stay', pageType: 'home', userRequested: true, refresh: true,
    excludeProductIds: first.products.slice(0, 4).map(p => p.id), ...ACTIVE })
  assert.equal(more.enabled, true)
  const firstTop = first.products.slice(0, 3).map(p => p.id)
  assert.ok(more.products.slice(0, 3).some(p => !firstTop.includes(p.id)), 'new ideas, not the same three again')
  // Automatic re-offer after the short cooldown also works on the same page.
  for (const log of db.logs) log.createdAt = new Date(Date.now() - 25 * 1000)
  const again = await engine.generateSuggestion({ sessionId: 'stay', pageType: 'home', refresh: true, ...ACTIVE })
  assert.equal(again.enabled, true)
})

test('"More ideas" on a product page rotates to different items', async () => {
  const engine = loadEngine(makeDb())
  const a = await engine.generateSuggestion({ sessionId: 'pmore', pageType: 'product', productId: 101, ...ACTIVE })
  const b = await engine.generateSuggestion({ sessionId: 'pmore', pageType: 'product', productId: 101, userRequested: true, refresh: true,
    excludeProductIds: a.products.slice(0, 4).map(p => p.id), ...ACTIVE })
  assert.equal(b.enabled, true)
  assert.notDeepEqual(b.products.slice(0, 3).map(p => p.id), a.products.slice(0, 3).map(p => p.id))
})

test('after closing a suggestion, navigating to another page shows a new one', async () => {
  const db = makeDb()
  const engine = loadEngine(db)
  const first = await engine.generateSuggestion({ sessionId: 'close', pageType: 'product', productId: 101, ...ACTIVE })
  assert.equal(first.enabled, true)
  const log = db.logs.find(l => String(l.id) === first.impressionToken)
  log.status = 'dismissed'; log.updatedAt = new Date()
  for (const [page, extra] of [['product', { productId: 201 }], ['category', { categoryRef: 'women' }], ['shop', {}], ['home', {}]]) {
    const r = await engine.generateSuggestion({ sessionId: 'close', pageType: page, ...ACTIVE, ...extra })
    assert.equal(r.enabled, true, `suggestion expected on ${page} after closing on another page`)
  }
})

test('personalisation opt-out still shows page suggestions, without using history', async () => {
  const db = makeDb({ preference: { personalizationEnabled: false }, events: [{ eventType: 'product_view', productId: 201, createdAt: new Date() }] })
  const engine = loadEngine(db)
  const r = await engine.generateSuggestion({ sessionId: 'opt', userId: 9, pageType: 'home', viewedProductIds: [201], ...ACTIVE })
  assert.equal(r.enabled, true)
  assert.notEqual(r.title, 'Picked for you')
  assert.ok(!r.products.some(p => /your browsing|your orders/.test(p.reason)))
})

test('no suggestion before the shopper has spent a moment on the page', async () => {
  const engine = loadEngine(makeDb())
  const r = await engine.generateSuggestion({ sessionId: 'g6', pageType: 'shop', activeMs: 1000 })
  assert.equal(r.enabled, false)
})

test('moving between pages shows new products instead of the same few again', async () => {
  const db = makeDb({ bestsellers: [101, 201, 104, 203] })
  const engine = loadEngine(db)
  const seen = []
  for (const pageType of ['home', 'shop', 'account']) {
    const r = await engine.generateSuggestion({ sessionId: 'tour', userId: null, pageType, ...ACTIVE })
    assert.equal(r.enabled, true, pageType)
    seen.push(r.products.slice(0, 3).map(p => p.id))
  }
  // The first three items of each page do not overlap with the previous page.
  assert.equal(seen[0].filter(id => seen[1].includes(id)).length, 0)
  assert.equal(seen[1].filter(id => seen[2].includes(id)).length, 0)
})

test('general pages rotate themes (bestsellers, on sale, discover...) with randomness', async () => {
  const titles = new Set()
  for (let i = 0; i < 12; i++) {
    const engine = loadEngine(makeDb({ bestsellers: [101, 201, 104, 203] }))
    const r = await engine.generateSuggestion({ sessionId: `rand-${i}`, pageType: 'home', ...ACTIVE })
    titles.add(r.title)
  }
  assert.ok(titles.size >= 3, `expected varied headlines, got ${[...titles].join(' | ')}`)
})

test('the same page never repeats the theme it just showed', async () => {
  const db = makeDb({ bestsellers: [101, 201, 104, 203] })
  const engine = loadEngine(db)
  const first = await engine.generateSuggestion({ sessionId: 'rep', pageType: 'home', ...ACTIVE })
  // Expire the cooldown so the page may suggest again.
  for (const log of db.logs) log.createdAt = new Date(Date.now() - 5 * 60 * 1000)
  const second = await engine.generateSuggestion({ sessionId: 'rep', pageType: 'home', ...ACTIVE })
  assert.equal(second.enabled, true)
  assert.notEqual(second.title, first.title)
})

test('every list includes one "something different" discovery pick when possible', async () => {
  const engine = loadEngine(makeDb())
  const r = await engine.generateSuggestion({ sessionId: 'disc', pageType: 'product', productId: 101, ...ACTIVE })
  const d = r.products.find(p => p.reason === 'Something different')
  assert.ok(d, 'discovery pick present')
  assert.equal(r.products.indexOf(d), 3, 'shown after the three most relevant items')
})

test('cart page: items -> checkout nudge (also on "More ideas"); empty -> browsing picks', async () => {
  const engine = loadEngine(makeDb())
  const full = await engine.generateSuggestion({ sessionId: 'c1', pageType: 'cart', cartProductIds: [101, 104], ...ACTIVE })
  assert.equal(full.ruleKey, 'cart_checkout')
  assert.match(full.message, /2 items/)
  const more = await engine.generateSuggestion({ sessionId: 'c1', pageType: 'cart', cartProductIds: [101, 104], userRequested: true, refresh: true, ...ACTIVE })
  assert.equal(more.action, 'continue_checkout', 'never switches the cart page to browsing while the bag has items')
  const empty = await engine.generateSuggestion({ sessionId: 'c2', pageType: 'cart', ...ACTIVE })
  assert.equal(empty.ruleKey, 'cart_empty_picks')
})

test('bag items left while browsing: reminder shows the bag itself', async () => {
  const engine = loadEngine(makeDb({ cart: [104, 201] }))
  const r = await engine.generateSuggestion({ sessionId: 'b1', userId: 5, pageType: 'home', ...ACTIVE })
  assert.equal(r.ruleKey, 'bag_waiting')
  assert.equal(r.ctaHref, '/customer/cart')
  assert.deepEqual(r.products.map(p => p.id), [104, 201])
  assert.ok(r.products.every(p => p.reason === 'In your bag'))
  // Only occasionally: the next home suggestion is a normal one again.
  const next = await engine.generateSuggestion({ sessionId: 'b1', userId: 5, pageType: 'home', userRequested: true, ...ACTIVE })
  assert.notEqual(next.ruleKey, 'bag_waiting')
})

test('speed: product catalogue is read once and reused, not queried per suggestion', async () => {
  const db = makeDb({ bestsellers: [101, 201, 104, 203] })
  let productQueries = 0
  const orig = db.product.findMany
  db.product.findMany = async (args) => { productQueries++; return orig(args) }
  db.product.count = async () => { productQueries++; return 0 }
  const engine = loadEngine(db)
  for (const page of [{ pageType: 'home' }, { pageType: 'shop' }, { pageType: 'category', categoryRef: 'men' }, { pageType: 'product', productId: 101 }, { pageType: 'search', searchQuery: 'linen' }, { pageType: 'cart', cartProductIds: [201] }]) {
    const r = await engine.generateSuggestion({ sessionId: 'speed', ...ACTIVE, ...page })
    assert.equal(r.enabled, true, page.pageType)
  }
  assert.equal(productQueries, 1, 'one catalogue load for six suggestions')
})

test('small category keeps its own headline and items after "More ideas"', async () => {
  const engine = loadEngine(makeDb())
  const first = await engine.generateSuggestion({ sessionId: 'small', pageType: 'category', categoryRef: 'men', ...ACTIVE })
  const more = await engine.generateSuggestion({ sessionId: 'small', pageType: 'category', categoryRef: 'men', userRequested: true, refresh: true,
    excludeProductIds: first.products.map(p => p.id), ...ACTIVE })
  for (const r of [first, more]) {
    assert.equal(r.title, 'Top picks in Men')
    assert.equal(r.products[0].categoryName, 'Men')
  }
})
