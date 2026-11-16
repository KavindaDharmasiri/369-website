const { spawnSync } = require('node:child_process')
const { databaseUrl } = require('./database-env.cjs')

const action = process.argv[2]
if (!['status', 'diff', 'deploy'].includes(action)) throw new Error('Use status, diff, or deploy')
const url = databaseUrl({ direct: true }).toString()
const args = action === 'diff'
  ? ['migrate', 'diff', '--from-url', url, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code']
  : ['migrate', action]
const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], {
  env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit', timeout: 180000,
})
process.exitCode = result.status ?? 1
