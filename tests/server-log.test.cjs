const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')
const { serverErrorRecord } = loadTypescript('src/lib/serverLog.ts')

test('server error records allowlist type/code without serializing SQL, secrets, PII or provider errors', () => {
  const error = Object.assign(new Error('postgresql://user:password@host/db address customer@example.invalid'), {
    code: 'P2022', meta: { query: 'SELECT private', password: 'secret' }, response: { photoUrl: 'private-photo' },
  })
  const record = serverErrorRecord('checkout.failed', error)
  assert.equal(record.code, 'P2022')
  assert.match(record.incidentId, /^[a-f0-9-]{36}$/)
  assert.doesNotMatch(JSON.stringify(record), /password|SELECT|private|customer@example/)
  assert.equal(serverErrorRecord('unsafe\ninput', { code: 'user-password' }).event, 'server.error')
  assert.equal(serverErrorRecord('checkout.failed', { code: 'user-password' }).code, undefined)
})
