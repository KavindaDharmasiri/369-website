// Real PostgreSQL tests in a uniquely named, disposable schema on the authorized DB.
// Never reads customer rows or runs fixtures in public. No external provider calls.
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const { databaseUrl } = require('./database-env.cjs')
const { PrismaClient } = require('@prisma/client')
const { loadTypescript } = require('../tests/load-typescript.cjs')

if (!process.argv.includes('--allow-isolated-schema')) {
  console.error('Requires --allow-isolated-schema: creates/migrates/tests/drops only a new verify_369_* schema on DATABASE_URL.')
  process.exit(1)
}
const schema = `verify_369_${randomUUID().replaceAll('-', '')}`
if (!/^verify_369_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid isolated schema')
// Fixtures and migrations use direct sessions, not transaction-pooler search_path.
const url = databaseUrl({ direct: true })
url.searchParams.set('schema', schema)
url.searchParams.set('connection_limit', '8')
const adminUrl = new URL(url)
adminUrl.searchParams.set('schema', 'public')
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } }, log: [] })
const clients = []
const lastQueries = new Map()
function client() {
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [{ emit: 'event', level: 'query' }] })
  // Record SQL shape only, never parameter values. Prisma qualifies ORM queries
  // by URL schema even when raw current_schema() reports the connection default.
  db.$on('query', event => lastQueries.set(db, event.query))
  clients.push(db)
  return db
}
// Quote signing is purpose-derived; never print this value. Real deployments use
// the configured JWT secret, while verification stays deterministic offline.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'verify-only-quote-signing-secret'
const cart = loadTypescript('src/lib/cartTransactions.ts')
const { reserveOrderStock } = loadTypescript('src/lib/orderItems.ts')
const { runOrderRequest, fingerprintOrderInput } = loadTypescript('src/lib/orderRequests.ts')
const { canonicalOrderInput } = loadTypescript('src/lib/orderRequestInput.ts')
const { calculateCheckout } = loadTypescript('src/lib/checkoutCalculation.ts')
const { issueQuote } = loadTypescript('src/lib/quoteToken.ts')
let checks = 0
async function check(name, run) {
  await run()
  checks++
  console.log(`PASS ${name}`)
}
async function main() {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
  try {
    const result = spawnSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8', timeout: 180000,
    })
    if (result.status !== 0) throw new Error(`Isolated migration failed: ${result.stderr || result.error?.message}`)
    console.log('PASS fresh-schema migration chain')
    checks++
    const db = client()
    assert.equal(await db.user.count(), 0)
    assert.ok(lastQueries.get(db)?.includes(`"${schema}"."users"`), 'Fixture ORM queries must target the generated schema, never public')
    const user = await db.user.create({ data: { email: `${schema}@example.invalid`, password: 'test-fixture-not-a-credential' } })
    const other = await db.user.create({ data: { email: `other-${schema}@example.invalid`, password: 'test-fixture-not-a-credential' } })
    const category = await db.category.create({ data: { name: 'Isolated fixtures' } })
    const subCategory = await db.subCategory.create({ data: { name: 'Isolated fixtures', categoryId: category.id } })
    const data = { status: 'ACTIVE', prodMarket: 'MARKETPLACE', prodName: 'Isolated shirt', prodDescription: 'Fixture only',
      prodImg: '/fixture.png', prodPrice: 100, categoryId: category.id, subCategoryId: subCategory.id }
    const product = await db.product.create({ data })
    const base = await db.product.create({ data: { ...data, prodName: 'Isolated base product' } })
    const sku = await db.productSku.create({ data: { productId: product.id, skuCode: 'FIXTURE-M', variantKeys: 'M', price: 100, stock: 100 } })
    const lines = cart.canonicalCartMerge({ items: [{ productId: product.id, skuId: sku.id, quantity: 2 }] })
    const key = 'postgres-same-key-0001'

    await check('concurrent same-key merge commits once', async () => {
      const results = await Promise.all(Array.from({ length: 4 }, () => cart.mergeCartBatch(db, user.id, key, lines)))
      assert.equal(results.filter(result => !result.replayed).length, 1)
      assert.equal(await db.cartMergeRequest.count(), 1)
      assert.equal((await db.cartItem.findFirstOrThrow({ where: { userId: user.id } })).quantity, 2)
    })
    await check('changed payload conflicts and owners are isolated', async () => {
      await assert.rejects(cart.mergeCartBatch(db, user.id, key, [{ ...lines[0], quantity: 3 }]), error => error.code === 'IDEMPOTENCY_CONFLICT')
      assert.equal((await cart.mergeCartBatch(db, other.id, key, lines)).replayed, false)
    })
    await check('new Prisma client replays durable acknowledgement without mutation', async () => {
      const fresh = client()
      assert.equal((await cart.mergeCartBatch(fresh, user.id, key, lines)).replayed, true)
      assert.equal((await db.cartItem.findFirstOrThrow({ where: { userId: user.id } })).quantity, 2)
    })
    await check('concurrent distinct imports preserve all additions on one SKU identity', async () => {
      await Promise.all(Array.from({ length: 5 }, (_, index) => cart.mergeCartBatch(db, user.id, `distinct-import-key-${index}`, [{ ...lines[0], quantity: 1 }])))
      assert.equal(await db.cartItem.count({ where: { userId: user.id } }), 1)
      assert.equal((await db.cartItem.findFirstOrThrow({ where: { userId: user.id } })).quantity, 7)
    })
    await check('invalid later line rolls back the entire merge and receipt', async () => {
      await assert.rejects(cart.mergeCartBatch(db, user.id, 'invalid-batch-key-01', [...lines, { productId: 2147483647, skuId: null, quantity: 1 }]))
      assert.equal(await db.cartMergeRequest.count({ where: { key: 'invalid-batch-key-01' } }), 0)
      assert.equal((await db.cartItem.findFirstOrThrow({ where: { userId: user.id } })).quantity, 7)
    })
    await check('post-write failure rolls back quantity and revision', async () => {
      const before = await db.cartItem.findFirstOrThrow({ where: { userId: user.id } })
      await assert.rejects(cart.cartTransaction(db, user.id, async tx => {
        await cart.appendCartLines(tx, user.id, lines)
        throw new Error('intentional isolated rollback')
      }))
      const after = await db.cartItem.findUniqueOrThrow({ where: { id: before.id } })
      assert.equal(after.quantity, before.quantity)
      assert.equal(after.revision, before.revision)
    })
    await check('database uniqueness protects NULL SKU and positive quantity bounds', async () => {
      await db.cartItem.create({ data: { userId: user.id, productId: base.id, quantity: 1 } })
      await assert.rejects(db.cartItem.create({ data: { userId: user.id, productId: base.id, quantity: 1 } }), error => error.code === 'P2002')
      await assert.rejects(db.cartItem.updateMany({ where: { userId: user.id }, data: { quantity: 0 } }))
    })
    await check('ABA edits advance revision and stale checkout cannot erase them', async () => {
      const snapshot = await db.cartItem.findMany({ where: { userId: user.id, productId: product.id } })
      const row = snapshot[0]
      await db.cartItem.update({ where: { id: row.id }, data: { quantity: row.quantity + 1 } })
      await db.cartItem.update({ where: { id: row.id }, data: { quantity: row.quantity } })
      await cart.cartTransaction(db, user.id, tx => cart.clearSubmittedCart(tx, user.id, snapshot,
        [{ productId: product.id, skuId: sku.id, quantity: row.quantity }]))
      assert.equal((await db.cartItem.findUniqueOrThrow({ where: { id: row.id } })).revision, row.revision + 2)
    })
    await check('checkout clears only matching unchanged submitted rows', async () => {
      const snapshot = await db.cartItem.findMany({ where: { userId: user.id } })
      const row = snapshot.find(item => item.productId === product.id)
      await cart.cartTransaction(db, user.id, tx => cart.clearSubmittedCart(tx, user.id, snapshot,
        [{ productId: product.id, skuId: sku.id, quantity: row.quantity }]))
      assert.equal(await db.cartItem.count({ where: { userId: user.id, productId: product.id } }), 0)
      assert.equal(await db.cartItem.count({ where: { userId: user.id, productId: base.id } }), 1)
    })
    await check('simultaneous final-stock reservations produce exactly one winner', async () => {
      await db.productSku.update({ where: { id: sku.id }, data: { stock: 1 } })
      const reservations = await Promise.allSettled(Array.from({ length: 2 }, () => db.$transaction(tx =>
        reserveOrderStock(tx, [{ productId: product.id, skuId: sku.id, quantity: 1 }]))))
      assert.equal(reservations.filter(result => result.status === 'fulfilled').length, 1)
      assert.equal((await db.productSku.findUniqueOrThrow({ where: { id: sku.id } })).stock, 0)
    })
    await check('simultaneous final coupon increments produce exactly one winner', async () => {
      const coupon = await db.coupon.create({ data: { code: 'FIXTURE', discountValue: 10, maxUses: 1 } })
      const results = await Promise.all(Array.from({ length: 2 }, () => db.$transaction(tx => tx.coupon.updateMany({
        where: { id: coupon.id, usedCount: { lt: 1 } }, data: { usedCount: { increment: 1 } },
      }))))
      assert.equal(results.reduce((sum, result) => sum + result.count, 0), 1)
    })
    const orderData = { userId: user.id, orderNumber: 'FIXTURE-ORDER', total: 100, subtotal: 100, tax: 0, shippingFee: 0,
      firstName: 'Fixture', lastName: 'Only', email: 'fixture@example.invalid', address: 'Fixture', city: 'Fixture',
      state: 'Fixture', zipCode: '00000', phone: '0000000000', paymentMethod: 'cash' }
    await check('real unique-index order receipt waiting replays one committed order', async () => {
      let callbacks = 0
      const results = await Promise.all(Array.from({ length: 3 }, () => runOrderRequest(db, user.id, 'order-request-fixture-01', 'a'.repeat(64), async tx => {
        callbacks++
        return tx.order.create({ data: orderData })
      })))
      assert.equal(callbacks, 1)
      assert.equal(results.filter(result => result.replayed).length, 2)
      assert.equal(await db.order.count(), 1)
    })
    await check('order failure rolls back stock, order and idempotency claim', async () => {
      await db.productSku.update({ where: { id: sku.id }, data: { stock: 10 } })
      await assert.rejects(runOrderRequest(db, user.id, 'order-rollback-fixture-01', 'b'.repeat(64), async tx => {
        await reserveOrderStock(tx, [{ productId: product.id, skuId: sku.id, quantity: 1 }])
        await tx.order.create({ data: { ...orderData, orderNumber: 'ROLLBACK-FIXTURE' } })
        throw new Error('intentional isolated rollback')
      }))
      assert.equal(await db.orderRequest.count({ where: { key: 'order-rollback-fixture-01' } }), 0)
      assert.equal(await db.order.count({ where: { orderNumber: 'ROLLBACK-FIXTURE' } }), 0)
      assert.equal((await db.productSku.findUniqueOrThrow({ where: { id: sku.id } })).stock, 10)
    })
    const auth = { verifyToken: token => token === 'fixture-valid' ? { userId: user.id, userType: 'customer', sessionVersion: 0 }
      : token === 'fixture-other' ? { userId: other.id, userType: 'customer', sessionVersion: 0 } : null }
    const route = loadTypescript('src/app/api/orders/route.ts', {
      '@/lib/db': db, './db': db, '@/lib/auth': auth, './auth': auth,
      '@/lib/notify': { createNotification: async () => {}, notifyLowStock: async () => {} },
    })
    const checkout = { ...orderData, items: [{ productId: product.id, skuId: sku.id, quantity: 1 }] }
    async function quoteFor(body, options = {}) {
      const input = canonicalOrderInput(body)
      const calculation = await calculateCheckout(db, input)
      return issueQuote(user.id, fingerprintOrderInput(input), calculation, options).quoteToken
    }
    async function orderRequest(body = checkout, options = {}) {
      const key = options.key || 'route-order-fixture-01'
      const token = options.token || 'fixture-valid'
      const quoteToken = options.omitQuote ? undefined : options.quoteToken ?? await quoteFor(body)
      const payload = { ...body, ...(quoteToken === undefined ? {} : { quoteToken }) }
      return new Request('http://fixture.invalid/api/orders', { method: 'POST', headers: {
        Authorization: `Bearer ${token}`, 'Idempotency-Key': key, 'Content-Type': 'application/json',
      }, body: JSON.stringify(payload) })
    }
    await check('real handler requires a current quote before writing', async () => {
      const before = await db.order.count()
      const response = await route.POST(await orderRequest(checkout, { key: 'route-quote-required-01', omitQuote: true }))
      assert.equal(response.status, 428)
      assert.equal((await response.json()).code, 'QUOTE_REQUIRED')
      assert.equal(await db.order.count(), before)
      assert.equal(await db.orderRequest.count({ where: { key: 'route-quote-required-01' } }), 0)
      assert.equal((await db.productSku.findUniqueOrThrow({ where: { id: sku.id } })).stock, 10)
    })
    await check('expired quote cannot create an order', async () => {
      const expired = await quoteFor(checkout, { lifetimeSeconds: 1, now: 1000 })
      const response = await route.POST(await orderRequest(checkout, { key: 'route-quote-expired-01', quoteToken: expired }))
      assert.equal(response.status, 409)
      assert.equal((await response.json()).code, 'QUOTE_EXPIRED')
      assert.equal(await db.orderRequest.count({ where: { key: 'route-quote-expired-01' } }), 0)
      assert.equal((await db.productSku.findUniqueOrThrow({ where: { id: sku.id } })).stock, 10)
    })
    await check('price change after quote issue returns QUOTE_CHANGED without writes', async () => {
      const accepted = await quoteFor(checkout)
      await db.productSku.update({ where: { id: sku.id }, data: { price: 110 } })
      try {
        const response = await route.POST(await orderRequest(checkout, { key: 'route-quote-changed-01', quoteToken: accepted }))
        assert.equal(response.status, 409)
        assert.equal((await response.json()).code, 'QUOTE_CHANGED')
        assert.equal(await db.orderRequest.count({ where: { key: 'route-quote-changed-01' } }), 0)
        assert.equal((await db.productSku.findUniqueOrThrow({ where: { id: sku.id } })).stock, 10)
      } finally {
        await db.productSku.update({ where: { id: sku.id }, data: { price: 100 } })
      }
    })
    await check('real order handler concurrent retry creates one order/item and clears only submitted bag row', async () => {
      await cart.mergeCartBatch(db, user.id, 'route-cart-fixture-01', [{ productId: product.id, skuId: sku.id, quantity: 1 }])
      const before = await db.order.count()
      const requests = [await orderRequest(), await orderRequest()]
      const responses = await Promise.all([route.POST(requests[0]), route.POST(requests[1])])
      assert.deepEqual(responses.map(response => response.status), [200, 200])
      const bodies = await Promise.all(responses.map(response => response.json()))
      assert.equal(bodies[0].data.orderId, bodies[1].data.orderId)
      assert.equal(responses.filter(response => response.headers.get('Idempotency-Replayed') === 'true').length, 1)
      assert.equal(await db.order.count(), before + 1)
      assert.equal(await db.orderItem.count({ where: { orderId: bodies[0].data.orderId } }), 1)
      assert.equal((await db.productSku.findUniqueOrThrow({ where: { id: sku.id } })).stock, 9)
      assert.equal(await db.cartItem.count({ where: { userId: user.id, productId: product.id } }), 0)
      assert.equal(await db.cartItem.count({ where: { userId: user.id, productId: base.id } }), 1)
    })
    await check('committed replay succeeds even when its quote has expired', async () => {
      const expired = await quoteFor(checkout, { lifetimeSeconds: 1, now: 1000 })
      const response = await route.POST(await orderRequest(checkout, { quoteToken: expired }))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Idempotency-Replayed'), 'true')
      assert.equal(await db.order.count({ where: { orderNumber: { startsWith: 'ORD-' } } }), 1)
      assert.equal((await db.productSku.findUniqueOrThrow({ where: { id: sku.id } })).stock, 9)
    })
    await check('real handler changed payload conflicts without another stock deduction', async () => {
      const response = await route.POST(await orderRequest({ ...checkout, items: [{ ...checkout.items[0], quantity: 2 }] }))
      assert.equal(response.status, 409)
      assert.equal((await response.json()).code, 'IDEMPOTENCY_CONFLICT')
      assert.equal((await db.productSku.findUniqueOrThrow({ where: { id: sku.id } })).stock, 9)
    })
    await check('real handler rejects invalid sessions and isolates order list owners', async () => {
      assert.equal((await route.POST(await orderRequest(checkout, { token: 'invalid', omitQuote: true }))).status, 401)
      const response = await route.GET(new Request('http://fixture.invalid/api/orders', { headers: { Authorization: 'Bearer fixture-other' } }))
      assert.equal(response.status, 200)
      assert.deepEqual((await response.json()).data.orders, [])
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    })
    console.log(`PostgreSQL verification: ${checks}/${checks} checks passed; isolated schema only.`)
  } finally {
    await Promise.all(clients.map(db => db.$disconnect()))
    // Exact name was generated and validated above; never accept a schema argument.
    await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`)
    console.log('Removed the generated isolated verification schema.')
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => admin.$disconnect())
