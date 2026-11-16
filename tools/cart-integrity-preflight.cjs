const { databaseUrl } = require('./database-env.cjs')
const { PrismaClient } = require('@prisma/client')

const url = databaseUrl({ direct: true })
const db = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] })
async function main() {
  const [version] = await db.$queryRaw`SELECT current_setting('server_version_num')::int AS version`
  const [duplicates] = await db.$queryRaw`SELECT count(*)::int AS count FROM (
    SELECT user_id, product_id, sku_id FROM cart_items GROUP BY user_id, product_id, sku_id HAVING count(*) > 1
  ) AS duplicate_groups`
  const invalid = await db.cartItem.count({ where: { OR: [{ quantity: { lt: 1 } }, { quantity: { gt: 1000 } }] } })
  console.log(JSON.stringify({ postgresVersion: version.version, duplicateCartGroups: duplicates.count, invalidCartQuantities: invalid }))
  if (version.version < 150000 || duplicates.count || invalid) throw new Error('Cart migration preflight blocked; no rows were changed')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => db.$disconnect())
