const { loadEnvConfig } = require('@next/env')

// Always run this module as a script/import, never print loadEnvConfig's return
// value: it contains secrets. Session-scoped migration settings require direct DB.
function databaseUrl({ direct = false } = {}) {
  loadEnvConfig(process.cwd())
  const value = direct ? process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL : process.env.DATABASE_URL
  if (!value) throw new Error('Database connection is not configured')
  const url = new URL(value)
  if (direct && url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace('-pooler.', '.')
  return url
}

module.exports = { databaseUrl }
