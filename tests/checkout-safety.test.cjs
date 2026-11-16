const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')

// Quote signing needs a deterministic test-only key. No production secret is read.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-quote-signing-secret'

const baseOrder = {
  email: 'test@example.invalid', firstName: 'Test', lastName: 'Customer', address: 'Example street',
  city: 'City', state: 'Region', zipCode: '00000', phone: '0000000000', paymentMethod: 'cash',
}
const line = (quantity = 1, extra = {}) => ({ productId: 1, skuId: 1, quantity, name: 'Untrusted name', price: 0, ...extra })
let requestSequence = 0
function keyedRequest(body, key, token = 'valid', method = 'POST') {
  return new Request('http://localhost/api/test', {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  })
}
function request(body, token = 'valid', method = 'POST') {
  return keyedRequest(body, `test-order-request-${++requestSequence}`, token, method)
}

function fixture(options = {}) {
  const state = {
    stock: options.stock ?? 5, orders: [], items: [], orderRequests: [], cartCleared: false,
    couponUses: 0, notifications: 0, lowStockNotifications: 0, settings: { taxRate: '0', lowStockThreshold: '0' },
    cartRows: options.cartRows || [],
  }
  const calls = []
  const coupon = {
    id: 1, code: 'SAVE', discountType: 'fixed', discountValue: 10, isActive: true,
    minSubtotal: null, maxDiscount: null, maxUses: 1, validFrom: null, validUntil: null,
  }
  const product = {
    id: 1, prodName: 'Trusted product', prodPrice: 100, status: 'ACTIVE', prodMarket: 'MARKETPLACE',
    isDeleted: false, stockStatus: true, categoryId: 1, subCategoryId: 1,
    category: { isActive: true }, subCategory: { isActive: true, categoryId: 1 },
    _count: { productSkus: options.noVariants ? 0 : 1 }, ...options.product,
  }
  const skuRow = { id: 1, productId: 1, price: 100, isActive: true,
    skuCode: 'TRUSTED-SKU', variantKeys: 'Small, Blue', ...options.sku }
  const skuRecord = () => ({ ...skuRow, stock: state.stock })
  function lazy(action) {
    return { then(resolve, reject) { return Promise.resolve().then(action).then(resolve, reject) } }
  }
  const db = {
    orderRequest: {
      findUnique: async ({ where }) => state.orderRequests.find(row => row.userId === where.userId_key.userId && row.key === where.userId_key.key) || null,
      create: async ({ data }) => {
        if (state.orderRequests.some(row => row.userId === data.userId && row.key === data.key)) throw Object.assign(new Error('Duplicate request'), { code: 'P2002' })
        const row = { id: state.orderRequests.length + 1, orderId: null, response: null, ...data }
        state.orderRequests.push(row)
        return row
      },
      update: async ({ where, data }) => Object.assign(state.orderRequests.find(row => row.id === where.id), data),
    },
    discount: { findMany: async () => options.discounts || [] },
    product: {
      findUnique: async () => product,
      findMany: async ({ where }) => (where.id.in.includes(product.id) ? [product] : []),
    },
    productSku: {
      findUnique: async () => skuRecord(),
      updateMany: async ({ where, data }) => {
        calls.push({ type: 'reserveStock', where, data })
        if (options.loseStockRace || state.stock < where.stock.gte) return { count: 0 }
        state.stock -= data.stock.decrement
        return { count: 1 }
      },
      findMany: async (args) => {
        if (args.where?.stock) { calls.push({ type: 'lowStock', ...args }); return [] }
        return [skuRecord()].filter(row => args.where?.id?.in?.includes(row.id))
      },
    },
    shippingFee: { findFirst: async () => null },
    appSetting: {
      findMany: async () => Object.entries(state.settings).map(([key, value]) => ({ key, value })),
      findUnique: async ({ where }) => ({ key: where.key, value: state.settings[where.key] }),
      upsert: (args) => {
        calls.push({ type: 'settingOperation', args })
        return lazy(() => {
          if (options.failSettings && args.where.key === 'taxRate') throw new Error('Simulated write failure')
          state.settings[args.where.key] = args.update.value
          return { key: args.where.key, value: args.update.value }
        })
      },
    },
    coupon: {
      findUnique: async () => ({ ...coupon, usedCount: state.couponUses, ...options.coupon }),
      updateMany: async (args) => {
        calls.push({ type: 'reserveCoupon', ...args })
        if (options.loseCouponRace || (args.where.usedCount && state.couponUses >= args.where.usedCount.lt)) return { count: 0 }
        state.couponUses++
        return { count: 1 }
      },
    },
    order: {
      create: async ({ data }) => {
        const order = { id: state.orders.length + 1, ...data }
        state.orders.push(order)
        return order
      },
      findMany: async (args) => { calls.push({ type: 'ordersRead', ...args }); return [] },
    },
    orderItem: { create: async ({ data }) => {
      if (options.failItem) throw new Error('Simulated order item failure')
      state.items.push(data)
      return data
    } },
    cartItem: {
      findFirst: async () => null,
      findMany: async ({ where }) => state.cartRows.filter(row => row.userId === where.userId && (!where.OR ||
        where.OR.some(line => row.productId === line.productId && row.skuId === line.skuId))),
      create: async ({ data }) => ({ id: 1, ...data }),
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async ({ where }) => ({ id: where.id, quantity: 1 }),
      deleteMany: async () => { state.cartCleared = true; return { count: 1 } },
    },
    user: { findUnique: async ({ where }) => ({ id: where.id, email: 'test@example.invalid', userType: options.admin ? 'admin' : 'customer', isActive: true, sessionVersion: 0 }), update: async ({ select }) => {
      calls.push({ type: 'profileSelect', select })
      const user = { id: 1, email: 'test@example.invalid', firstName: 'Test', password: 'FAKE-HASH' }
      return select ? Object.fromEntries(Object.entries(user).filter(([key]) => select[key])) : user
    } },
    $queryRaw: async () => { if (options.healthFailure) throw new Error('PRIVATE DATABASE ERROR') },
    $transaction: async (work) => {
      calls.push({ type: 'transaction' })
      const snapshot = structuredClone(state)
      try {
        if (typeof work === 'function') return await work(db)
        const results = []
        for (const operation of work) results.push(await operation)
        return results
      } catch (error) {
        Object.assign(state, snapshot)
        throw error
      }
    },
  }
  const mocks = {
    '@/lib/db': db,
    '@/lib/auth': { verifyToken: token => token === 'valid' ? { userId: 1, userType: options.admin ? 'admin' : 'customer' } : token === 'user2' ? { userId: 2, userType: 'customer' } : null },
    '@/lib/notify': {
      createNotification: async (args) => { state.notifications++; calls.push({ type: 'notification', args }) },
      notifyLowStock: async () => { state.lowStockNotifications++ },
    },
    '@/lib/encryption': { encrypt: value => value, encryptData: value => JSON.stringify(value) },
  }
  mocks['./db'] = db
  mocks['./auth'] = mocks['@/lib/auth']
  // Real quote signing/verification against this fixture's pricing calculation,
  // so order tests exercise the actual QUOTE_* contract rather than a stub.
  const { canonicalOrderInput } = loadTypescript('src/lib/orderRequestInput.ts')
  const { fingerprintOrderInput } = loadTypescript('src/lib/orderRequests.ts')
  const { calculateCheckout } = loadTypescript('src/lib/checkoutCalculation.ts')
  const { issueQuote } = loadTypescript('src/lib/quoteToken.ts')
  async function quote(body, userId = 1, options = {}) {
    const input = canonicalOrderInput(body)
    const calculation = await calculateCheckout(db, input)
    return issueQuote(userId, fingerprintOrderInput(input), calculation, options).quoteToken
  }
  async function checkout(body, options = {}) {
    const payload = { ...body, quoteToken: options.quoteToken ?? await quote(body, options.userId ?? 1) }
    return options.key ? keyedRequest(payload, options.key, options.token, options.method)
      : request(payload, options.token, options.method)
  }
  // Simulates the real race where a product/variant changes after a quote was
  // issued: the quote stays cryptographically valid but pricing/eligibility moved.
  function mutate(patch = {}) {
    if (patch.product) Object.assign(product, patch.product)
    if (patch.sku) Object.assign(skuRow, patch.sku)
  }
  return { state, calls, db, mocks, quote, checkout, mutate,
    load: filename => loadTypescript(filename, mocks) }
}

test('order rejects invalid quantities and bodies before transaction work', async (t) => {
  const cases = [-1, 0, 1.5, 1001, '2', null, undefined]
  for (const quantity of cases) await t.test(`quantity ${String(quantity)}`, async () => {
    const f = fixture()
    const response = await f.load('src/app/api/orders/route.ts').POST(request({ ...baseOrder, items: [line(quantity, { quantity })] }))
    assert.equal(response.status, 400)
    assert.equal(f.state.stock, 5)
    assert.equal(f.calls.length, 0)
  })
  for (const items of [null, {}, [], Array.from({ length: 101 }, () => line())]) await t.test(`invalid item container ${Array.isArray(items) ? items.length : typeof items}`, async () => {
    const f = fixture()
    const response = await f.load('src/app/api/orders/route.ts').POST(request({ ...baseOrder, items }))
    assert.equal(response.status, 400)
    assert.equal(f.calls.length, 0)
  })
})

test('malformed JSON and missing delivery/payment fields return 400 without writes', async () => {
  const f = fixture()
  const route = f.load('src/app/api/orders/route.ts')
  const malformed = new Request('http://localhost/api/orders', { method: 'POST', headers: { Authorization: 'Bearer valid' }, body: '{' })
  assert.equal((await route.POST(malformed)).status, 400)
  for (const extra of [{ firstName: ' ' }, { email: 'bad' }, { paymentMethod: 'crypto' }, { items: [line(1, { productId: -1 })] }]) {
    assert.equal((await route.POST(request({ ...baseOrder, items: [line()], ...extra }))).status, 400)
  }
  assert.equal(f.calls.length, 0)
})

test('invalid tokens return 401 for order GET/POST without DB access', async () => {
  const f = fixture()
  const route = f.load('src/app/api/orders/route.ts')
  assert.equal((await route.POST(request({ ...baseOrder, items: [line()] }, 'invalid'))).status, 401)
  assert.equal((await route.GET(request(null, 'invalid', 'GET'))).status, 401)
  assert.equal(f.calls.length, 0)
})

test('duplicate SKU lines cannot oversell and produce no partial writes', async () => {
  const f = fixture({ stock: 8 })
  const body = { ...baseOrder, items: [line(4), line(4)] }
  const quoteToken = await f.quote(body)
  f.state.stock = 5
  const response = await f.load('src/app/api/orders/route.ts').POST(await f.checkout(body, { quoteToken }))
  assert.equal(response.status, 409)
  assert.equal(f.state.stock, 5)
  assert.equal(f.state.orders.length, 0)
  assert.equal(f.state.cartCleared, false)
})

test('duplicate lines within stock are combined and use trusted names/specs and zero tax', async () => {
  const f = fixture({ cartRows: [{ id: 7, userId: 1, productId: 1, skuId: 1, quantity: 3, revision: 1 }] })
  const response = await f.load('src/app/api/orders/route.ts').POST(
    await f.checkout({ ...baseOrder, items: [line(1), line(2)], total: -99 }))
  assert.equal(response.status, 200)
  assert.equal(f.state.stock, 2)
  assert.equal(f.state.items.length, 1)
  assert.equal(f.state.items[0].quantity, 3)
  assert.equal(f.state.items[0].productName, 'Trusted product')
  assert.deepEqual(JSON.parse(f.state.items[0].specs), { variant: 'Small, Blue' })
  assert.equal(f.state.orders[0].tax, 0)
  assert.equal(f.state.orders[0].total, 300)
  assert.equal(f.state.cartCleared, true)
  const reservation = f.calls.find(call => call.type === 'reserveStock')
  assert.deepEqual(reservation.where.stock, { gte: 3 })
  assert.equal(reservation.where.isActive, true)
  assert.equal(reservation.where.productId, 1)
})

test('conditional stock reservation failure returns 409', async () => {
  const f = fixture({ loseStockRace: true })
  assert.equal((await f.load('src/app/api/orders/route.ts').POST(await f.checkout({ ...baseOrder, items: [line()] }))).status, 409)
  assert.equal(f.state.orders.length, 0)
  assert.equal(f.state.cartCleared, false)
})

test('BOTH publication is saleable consistently with the public catalog', async () => {
  const f = fixture({ product: { prodMarket: 'BOTH' } })
  assert.equal((await f.load('src/app/api/orders/route.ts').POST(await f.checkout({ ...baseOrder, items: [line()] }))).status, 200)
  assert.equal(f.state.stock, 4)
})

test('order-item failure rolls stock and coupon reservation back in the transaction substitute', async () => {
  const f = fixture({ failItem: true })
  assert.equal((await f.load('src/app/api/orders/route.ts').POST(await f.checkout({ ...baseOrder, items: [line()], couponCode: 'SAVE' }))).status, 500)
  assert.equal(f.state.stock, 5)
  assert.equal(f.state.couponUses, 0)
  assert.equal(f.state.orders.length, 0)
  assert.equal(f.state.cartCleared, false)
})

test('SKU omission is rejected for variants but a genuine SKU-less product is supported', async () => {
  const variant = fixture()
  await assert.rejects(variant.quote({ ...baseOrder, items: [line(1, { skuId: null })] }), /select a variant/i)
  assert.equal(variant.state.orders.length, 0)
  const simple = fixture({ noVariants: true })
  assert.equal((await simple.load('src/app/api/orders/route.ts').POST(
    await simple.checkout({ ...baseOrder, items: [line(1, { skuId: null })] }))).status, 200)
  assert.equal(simple.calls.filter(call => call.type === 'reserveStock').length, 0)
})

test('unpublished, deleted, inactive-category and mismatched SKU products are rejected', async (t) => {
  for (const options of [
    { product: { prodMarket: 'DRAFT' } }, { product: { isDeleted: true } },
    { product: { status: 'INACTIVE' } }, { product: { category: { isActive: false } } },
    { product: { subCategory: { isActive: true, categoryId: 2 } } },
    { sku: { productId: 2 } }, { sku: { isActive: false } },
  ]) await t.test(JSON.stringify(options), async () => {
    const f = fixture()
    const body = { ...baseOrder, items: [line()] }
    const quoteToken = await f.quote(body)
    // The quote was valid when issued; the product/variant changed before submit.
    f.mutate(options)
    assert.equal((await f.load('src/app/api/orders/route.ts').POST(await f.checkout(body, { quoteToken }))).status, 404)
    assert.equal(f.state.orders.length, 0)
  })
})

test('finite coupons use a conditional increment and stop at the usage limit', async () => {
  const f = fixture()
  const route = f.load('src/app/api/orders/route.ts')
  const body = { ...baseOrder, items: [line()], couponCode: 'SAVE' }
  // Both quotes are issued while the coupon is still available; the second order
  // must revalidate usage rather than trusting the accepted quote.
  const [first, second] = [await f.checkout(body), await f.checkout(body)]
  assert.equal((await route.POST(first)).status, 200)
  assert.equal(f.state.couponUses, 1)
  const reservation = f.calls.find(call => call.type === 'reserveCoupon')
  assert.deepEqual(reservation.where.usedCount, { lt: 1 })
  assert.equal((await route.POST(second)).status, 400)
  assert.equal(f.state.orders.length, 1)
})

test('lost coupon race returns conflict and rolls stock back', async () => {
  const f = fixture({ loseCouponRace: true })
  assert.equal((await f.load('src/app/api/orders/route.ts').POST(
    await f.checkout({ ...baseOrder, items: [line()], couponCode: 'SAVE' }))).status, 409)
  assert.equal(f.state.stock, 5)
  assert.equal(f.state.orders.length, 0)
})

test('profile update selects public fields and excludes password from decoded output', async () => {
  const f = fixture()
  const response = await f.load('src/app/api/profile/route.ts').PUT(request({ firstName: 'Test' }))
  assert.equal(response.status, 200)
  const profile = JSON.parse((await response.json()).data).profile
  assert.equal(profile.email, 'test@example.invalid')
  assert.equal(Object.hasOwn(profile, 'password'), false)
  assert.equal(f.calls.find(call => call.type === 'profileSelect').select.password, undefined)
})

test('invalid settings do not start any writes; valid zero values are preserved', async () => {
  const f = fixture({ admin: true })
  const route = f.load('src/app/api/settings/route.ts')
  for (const body of [{ taxMode: 'fixed', taxRate: -1 }, { taxRate: 'Infinity' }, { taxMode: 'fixed', lowStockThreshold: 1.5 }, { taxRate: null }]) {
    assert.equal((await route.PUT(request(body))).status, 400)
  }
  assert.equal(f.calls.length, 0)
  assert.equal((await route.PUT(request({ taxMode: 'fixed', taxRate: 0, lowStockThreshold: 0 }))).status, 200)
  const settings = await f.load('src/lib/settings.ts').getAppSettings()
  assert.equal(settings.taxRate, 0)
  assert.equal(settings.lowStockThreshold, 0)
  assert.equal(f.calls.filter(call => call.type === 'transaction').length, 1)
})

test('settings transaction substitute rolls an earlier update back on write failure', async () => {
  const f = fixture({ admin: true, failSettings: true })
  const before = structuredClone(f.state.settings)
  assert.equal((await f.load('src/app/api/settings/route.ts').PUT(request({ taxMode: 'fixed', taxRate: 2 }))).status, 500)
  assert.deepEqual(f.state.settings, before)
})

test('low-stock notifications respect a zero threshold', async () => {
  const f = fixture()
  await f.load('src/lib/notify.ts').notifyLowStock()
  assert.equal(f.calls.find(call => call.type === 'lowStock').where.stock.lte, 0)
})

test('health is dynamic, no-store, minimal, and reports database failure as 503', async () => {
  for (const healthFailure of [false, true]) {
    const f = fixture({ healthFailure })
    const health = f.load('src/app/api/health/route.ts')
    assert.equal(health.dynamic, 'force-dynamic')
    const response = await health.GET()
    assert.equal(response.status, healthFailure ? 503 : 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.deepEqual(await response.json(), { status: healthFailure ? 'unavailable' : 'ok' })
  }
})

test('cart POST/PATCH reject invalid quantities before DB access', async () => {
  for (const quantity of [-1, 0, 0.5, 1001]) {
    const f = fixture()
    assert.equal((await f.load('src/app/api/cart/route.ts').POST(request(line(quantity)))).status, 400)
    assert.equal((await f.load('src/app/api/cart/[id]/route.ts').PATCH(request({ quantity }), { params: { id: '1' } })).status, 400)
    assert.equal(f.calls.length, 0)
  }
})

test('cart POST enforces required variants and defaults omitted quantity to one', async () => {
  const f = fixture()
  const route = f.load('src/app/api/cart/route.ts')
  assert.equal((await route.POST(request({ productId: 1 }))).status, 400)
  const response = await route.POST(request({ productId: 1, skuId: 1 }))
  assert.equal(response.status, 200)
  const cartItem = JSON.parse((await response.json()).data).cartItem
  assert.equal(cartItem.quantity, 1)
})

test('adding to an existing cart line uses a locked, validated quantity and revision condition', async () => {
  const f = fixture()
  f.db.cartItem.findMany = async () => [{ id: 7, userId: 1, productId: 1, skuId: 1, quantity: 2, revision: 4 }]
  let update
  f.db.cartItem.updateMany = async (args) => { update = args; return { count: 1 } }
  f.db.cartItem.findUniqueOrThrow = async () => ({ id: 7, quantity: 3 })
  const response = await f.load('src/app/api/cart/route.ts').POST(request(line(1)))
  assert.equal(response.status, 200)
  assert.equal(update.data.quantity, 3)
  assert.equal(update.where.revision, 4)
  assert.equal(update.where.userId, 1)
})

test('order creation requires a valid idempotency key before any database work', async () => {
  const f = fixture()
  const route = f.load('src/app/api/orders/route.ts')
  const body = JSON.stringify({ ...baseOrder, items: [line()] })
  for (const key of [undefined, '', 'short', 'has space in it 0001', 'a'.repeat(129)]) {
    const headers = { Authorization: 'Bearer valid', 'Content-Type': 'application/json' }
    if (key !== undefined) headers['Idempotency-Key'] = key
    const response = await route.POST(new Request('http://localhost/api/orders', { method: 'POST', headers, body }))
    assert.equal(response.status, 400)
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    assert.match((await response.json()).error, /Idempotency-Key/)
  }
  assert.equal(f.state.orders.length, 0)
  assert.equal(f.state.stock, 5)
  assert.equal(f.calls.length, 0)
})

test('new orders require a current quote and reject missing or expired quotes before any write', async (t) => {
  for (const [label, token, status, code] of [
    ['missing', undefined, 428, 'QUOTE_REQUIRED'],
    ['empty', '', 428, 'QUOTE_REQUIRED'],
  ]) await t.test(label, async () => {
    const f = fixture()
    const response = await f.load('src/app/api/orders/route.ts').POST(
      request({ ...baseOrder, items: [line()], ...(token === undefined ? {} : { quoteToken: token }) }))
    assert.equal(response.status, status)
    assert.equal((await response.json()).code, code)
    assert.equal(f.calls.length, 0)
    assert.equal(f.state.stock, 5)
    assert.equal(f.state.orders.length, 0)
  })

  await t.test('expired', async () => {
    const f = fixture()
    const body = { ...baseOrder, items: [line()] }
    const quoteToken = await f.quote(body, 1, { lifetimeSeconds: 1, now: 1000 })
    const response = await f.load('src/app/api/orders/route.ts').POST(request({ ...body, quoteToken }))
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'QUOTE_EXPIRED')
    assert.equal(f.calls.length, 0)
    assert.equal(f.state.stock, 5)
    assert.equal(f.state.orderRequests.length, 0)
  })
})

test('a quote issued before a price change is rejected with QUOTE_CHANGED and no writes', async () => {
  const f = fixture()
  const body = { ...baseOrder, items: [line()] }
  const quoteToken = await f.quote(body)
  f.mutate({ sku: { price: 125 } })
  const response = await f.load('src/app/api/orders/route.ts').POST(request({ ...body, quoteToken }))
  assert.equal(response.status, 409)
  assert.equal((await response.json()).code, 'QUOTE_CHANGED')
  assert.equal(f.state.stock, 5)
  assert.equal(f.state.orders.length, 0)
  assert.equal(f.state.orderRequests.length, 0)
  assert.equal(f.state.cartCleared, false)
})

test('a committed order replays with the same key even after its quote expires', async () => {
  const f = fixture()
  const route = f.load('src/app/api/orders/route.ts')
  const key = 'checkout-expired-replay-01'
  const body = { ...baseOrder, items: [line()] }
  assert.equal((await route.POST(await f.checkout(body, { key }))).status, 200)
  const callsAfterFirst = f.calls.length
  const expired = await f.quote(body, 1, { lifetimeSeconds: 1, now: 1000 })
  const replay = await route.POST(await f.checkout(body, { key, quoteToken: expired }))
  assert.equal(replay.status, 200)
  assert.equal(replay.headers.get('Idempotency-Replayed'), 'true')
  assert.equal(f.state.orders.length, 1)
  assert.equal(f.state.stock, 4)
  assert.equal(f.calls.length, callsAfterFirst)
})

test('same key and canonical payload replays the stored order without duplicate writes or notifications', async () => {
  const f = fixture()
  const route = f.load('src/app/api/orders/route.ts')
  const key = 'checkout-route-0001'
  const first = await route.POST(await f.checkout({ ...baseOrder, items: [line()], total: -1 }, { key }))
  assert.equal(first.status, 200)
  const firstBody = await first.json()
  assert.equal(first.headers.get('Idempotency-Replayed'), 'false')
  assert.equal(first.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(f.state.stock, 4)
  assert.equal(f.state.orders.length, 1)
  assert.equal(f.state.notifications, 1)
  assert.equal(f.state.lowStockNotifications, 1)
  const callsAfterFirst = f.calls.length

  // A retry carries a freshly issued quote, so it must be minted while stock
  // still allows a quote; the replay must not re-run pricing or writes anyway.
  const replayToken = await f.quote({
    ...baseOrder, address: ` ${baseOrder.address} `,
    items: [{ ...line(), name: 'Spoofed name', price: -5 }],
  })
  f.state.stock = 0
  f.state.cartCleared = false
  const replay = await route.POST(await f.checkout({
    ...baseOrder, address: ` ${baseOrder.address} `,
    items: [{ ...line(), name: 'Spoofed name', price: -5 }],
  }, { key, quoteToken: replayToken }))
  assert.equal(replay.status, 200)
  assert.equal(replay.headers.get('Idempotency-Replayed'), 'true')
  assert.equal(replay.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual((await replay.json()).data, firstBody.data)
  assert.equal(f.state.stock, 0)
  assert.equal(f.state.cartCleared, false)
  assert.equal(f.state.orders.length, 1)
  assert.equal(f.state.notifications, 1)
  assert.equal(f.state.lowStockNotifications, 1)
  assert.equal(f.calls.length, callsAfterFirst)
})

test('same key with a different canonical payload conflicts without new writes', async () => {
  const f = fixture()
  const route = f.load('src/app/api/orders/route.ts')
  const key = 'checkout-conflict-0001'
  assert.equal((await route.POST(await f.checkout({ ...baseOrder, items: [line()] }, { key }))).status, 200)
  const conflict = await route.POST(await f.checkout({ ...baseOrder, phone: '1111111111', items: [line()] }, { key }))
  assert.equal(conflict.status, 409)
  assert.equal((await conflict.json()).code, 'IDEMPOTENCY_CONFLICT')
  assert.equal(f.state.stock, 4)
  assert.equal(f.state.orders.length, 1)
  assert.equal(f.state.notifications, 1)
})

test('a failed order transaction rolls back its receipt so the same key can retry', async () => {
  const f = fixture({ failItem: true })
  const route = f.load('src/app/api/orders/route.ts')
  const key = 'checkout-rollback-0001'
  const body = { ...baseOrder, items: [line()] }
  assert.equal((await route.POST(await f.checkout(body, { key }))).status, 500)
  assert.equal(f.state.orderRequests.length, 0)
  assert.equal(f.state.stock, 5)
  assert.equal(f.state.orders.length, 0)
  assert.equal(f.state.notifications, 0)
  f.db.orderItem.create = async ({ data }) => { f.state.items.push(data); return data }
  const retry = await route.POST(await f.checkout(body, { key }))
  assert.equal(retry.status, 200)
  assert.equal(f.state.orders.length, 1)
  assert.equal(f.state.notifications, 1)
})

test('resolution is authenticated, owner-scoped and never reveals or cancels another user order', async () => {
  const f = fixture()
  const route = f.load('src/app/api/orders/route.ts')
  const resolve = f.load('src/app/api/orders/requests/[key]/route.ts')
  const key = 'checkout-resolve-0001'
  assert.equal((await route.POST(await f.checkout({ ...baseOrder, items: [line()] }, { key }))).status, 200)

  assert.equal((await resolve.POST(request(null, 'invalid', 'POST'), { params: { key } })).status, 401)
  assert.equal((await resolve.POST(request(null, 'valid', 'POST'), { params: { key: 'bad key' } })).status, 400)

  const owner = await resolve.POST(request(null, 'valid', 'POST'), { params: { key } })
  assert.equal(owner.status, 200)
  assert.equal((await owner.json()).data.state, 'completed')
  assert.equal((await resolve.POST(request(null, 'valid', 'POST'), { params: { key } })).headers.get('Cache-Control'), 'private, no-store')

  const other = await resolve.POST(request(null, 'user2', 'POST'), { params: { key } })
  assert.equal(other.status, 200)
  assert.equal((await other.json()).data.state, 'abandoned')

  const late = await route.POST(await f.checkout({ ...baseOrder, items: [line()] },
    { key, token: 'user2', userId: 2 }))
  assert.equal(late.status, 409)
  assert.equal((await late.json()).code, 'ORDER_REQUEST_ABANDONED')
  assert.equal(f.state.orders.length, 1)
  assert.equal(f.state.stock, 4)
})

test('retiring a missing identity prevents a late order for that user and key', async () => {
  const f = fixture()
  const route = f.load('src/app/api/orders/route.ts')
  const resolve = f.load('src/app/api/orders/requests/[key]/route.ts')
  const key = 'checkout-abandoned-0001'
  const retired = await resolve.POST(request(null, 'valid', 'POST'), { params: { key } })
  assert.equal(retired.status, 200)
  assert.equal((await retired.json()).data.state, 'abandoned')
  const late = await route.POST(await f.checkout({ ...baseOrder, items: [line()] }, { key }))
  assert.equal(late.status, 409)
  assert.equal((await late.json()).code, 'ORDER_REQUEST_ABANDONED')
  assert.equal(f.state.orders.length, 0)
  assert.equal(f.state.stock, 5)
  assert.equal(f.state.notifications, 0)
})
