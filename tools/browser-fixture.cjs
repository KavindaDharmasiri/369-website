// Opt-in synthetic browser environment. The normal/public DB is never seeded.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { spawn, spawnSync } = require('node:child_process')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const { databaseUrl } = require('./database-env.cjs')
const marker = path.resolve('.next/browser-fixture.json')

if (process.argv.includes('--stop')) {
  const saved = JSON.parse(fs.readFileSync(marker, 'utf8'))
  assert.match(saved.schema, /^verify_369_browser_[a-f0-9]{32}$/)
  assert.ok(Date.now() - saved.startedAt < 10 * 60 * 1000, 'Refuse a stale process marker')
  process.kill(saved.pid)
  console.log('Stopped the recorded fixture server; its parent will remove only its generated schema.')
} else {
  if (!process.argv.includes('--allow-isolated-schema')) throw new Error('Requires --allow-isolated-schema')
  if (fs.existsSync(marker)) throw new Error('A fixture marker already exists; do not overwrite it')
  const schema = `verify_369_browser_${randomUUID().replaceAll('-', '')}`
  const url = databaseUrl({ direct: true })
  const admin = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] })
  url.searchParams.set('schema', schema)
  let query = ''
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [{ emit: 'event', level: 'query' }] })
  db.$on('query', event => { query = event.query })
  async function main() {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    let server
    let timer
    try {
      const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
        env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8', timeout: 180000,
      })
      if (migration.status !== 0) throw new Error('Fixture schema migration failed')
      assert.equal(await db.user.count(), 0)
      assert.ok(query.includes(`"${schema}"."users"`), 'Refuse fixtures outside generated schema')
      await db.user.create({ data: { email: 'browser-fixture@example.invalid',
        password: await bcrypt.hash('Fixture-only-pass-369!', 10), firstName: 'Browser', lastName: 'Fixture' } })
      const category = await db.category.create({ data: { name: 'Fixture', slug: 'fixture' } })
      const sub = await db.subCategory.create({ data: { name: 'Shirts', categoryId: category.id, slug: 'shirts' } })
      const product = await db.product.create({ data: { prodName: 'Browser Fixture Shirt', prodDescription: 'Synthetic verification only',
        prodImg: '/icon.svg', prodPrice: 100, status: 'ACTIVE', prodMarket: 'MARKETPLACE', stockStatus: true,
        prodCategoryName: 'Fixture', prodSubCategoryName: 'Shirts', categoryId: category.id, subCategoryId: sub.id,
        featuredOnHomepage: true, showInNewArrivals: true, slug: 'browser-fixture-shirt' } })
      await db.productSpec.create({ data: { productId: product.id, name: 'Size', orderNo: 1,
        attributes: { create: { name: 'M', value: 'M' } } } })
      const sku = await db.productSku.create({ data: { productId: product.id, skuCode: 'BROWSER-FIXTURE-M', variantKeys: 'M', price: 100, stock: 10 } })
      await db.appSetting.createMany({ data: [{ key: 'taxMode', value: 'percentage' }, { key: 'taxRate', value: '0' }] })
      server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3102'], {
        env: { ...process.env, DATABASE_URL: url.toString(), JWT_SECRET: randomUUID() + randomUUID(), NEXT_TELEMETRY_DISABLED: '1' },
        stdio: ['ignore', 'inherit', 'inherit'],
      })
      fs.writeFileSync(marker, JSON.stringify({ schema, pid: server.pid, startedAt: Date.now() }), { flag: 'wx' })
      console.log(JSON.stringify({ fixtureUrl: 'http://127.0.0.1:3102', productId: product.id, skuId: sku.id,
        email: 'browser-fixture@example.invalid', note: 'Synthetic credentials in this script; automatic cleanup after seven minutes.' }))
      timer = setTimeout(() => server.kill(), 7 * 60 * 1000)
      await new Promise((resolve, reject) => { server.once('exit', resolve); server.once('error', reject) })
    } finally {
      if (timer) clearTimeout(timer)
      if (server && server.exitCode === null) server.kill()
      if (fs.existsSync(marker) && JSON.parse(fs.readFileSync(marker, 'utf8')).schema === schema) fs.unlinkSync(marker)
      await db.$disconnect()
      await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`)
      await admin.$disconnect()
      console.log('Removed only the generated browser fixture schema and process marker.')
    }
  }
  main().catch(() => { console.error('Browser fixture failed; inspect schema/process cleanup before retrying.'); process.exitCode = 1 })
}
