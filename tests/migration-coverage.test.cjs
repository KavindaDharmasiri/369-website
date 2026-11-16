const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { catalog, compareCatalogs } = require('../tools/migration-coverage.cjs')

test('structural migration checker detects missing columns, defaults, indexes and FK definitions', () => {
  const baseline = 'CREATE TABLE "items" (\n "id" INTEGER NOT NULL,\n "status" TEXT DEFAULT \'old\'\n);'
  const target = 'CREATE TABLE "items" (\n "id" INTEGER NOT NULL,\n "status" TEXT DEFAULT \'new\',\n "name" TEXT\n);\nCREATE INDEX "items_name_idx" ON "items"("name");'
  const gaps = compareCatalogs(catalog(baseline), catalog(target))
  assert.ok(gaps.includes('Column mismatch items.status'))
  assert.ok(gaps.includes('Column mismatch items.name'))
  assert.ok(gaps.includes('indexes mismatch items_name_idx'))
  const forward = baseline + '\nALTER TABLE "items" ADD COLUMN "name" TEXT;\nALTER TABLE "items" ALTER COLUMN "status" SET DEFAULT \'new\';\nCREATE INDEX "items_name_idx" ON "items"("name");'
  assert.deepEqual(compareCatalogs(catalog(forward), catalog(target)), [])
  const fk = 'ALTER TABLE "items" ADD CONSTRAINT "items_parent_fkey" FOREIGN KEY ("id") REFERENCES "parents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;'
  assert.ok(compareCatalogs(catalog(target), catalog(target + '\n' + fk)).includes('foreignKeys mismatch items_parent_fkey'))
})

test('new migrations are additive, transactional and include scoped order identity uniqueness', () => {
  const directory = path.join(__dirname, '../prisma/migrations')
  const baseline = fs.readFileSync(path.join(directory, '0_init/migration.sql'), 'utf8')
  const parity = fs.readFileSync(path.join(directory, '202611130001_schema_parity/migration.sql'), 'utf8')
  const identities = fs.readFileSync(path.join(directory, '202611130002_order_requests/migration.sql'), 'utf8')
  for (const sql of [parity, identities]) {
    assert.match(sql, /^BEGIN;/m)
    assert.match(sql, /^COMMIT;/m)
    assert.doesNotMatch(sql, /^\s*(DROP\s|TRUNCATE\s|DELETE FROM\s|UPDATE\s)/m)
  }
  assert.equal(catalog(baseline + '\n' + parity).tables.size, catalog(baseline).tables.size + 10)
  assert.match(identities, /CREATE UNIQUE INDEX "order_requests_user_id_key_key" ON "order_requests"\("user_id", "key"\)/)
  assert.match(identities, /"response" JSONB/)
})
