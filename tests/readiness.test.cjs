const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')
const { createReadinessProbe } = loadTypescript('src/lib/readiness.ts')

test('readiness bounds a hung dependency and coalesces concurrent probes', async () => {
  let calls = 0
  let finish
  const probe = createReadinessProbe(() => { calls++; return new Promise(resolve => { finish = resolve }) }, 5)
  assert.deepEqual(await Promise.all([probe(), probe(), probe()]), [false, false, false])
  assert.equal(calls, 1)
  finish()
  await Promise.resolve()
  await Promise.resolve()
})

test('readiness failures are contained and subsequent requests can recover', async () => {
  let calls = 0
  const probe = createReadinessProbe(async () => { if (calls++ === 0) throw new Error('private DB detail') })
  assert.equal(await probe(), false)
  assert.equal(await probe(), true)
})

test('liveness is minimal, dynamic, no-store, and has no database dependency', async () => {
  const route = loadTypescript('src/app/api/health/live/route.ts')
  assert.equal(route.dynamic, 'force-dynamic')
  const response = await route.GET()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { status: 'alive' })
})
