const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')
const { startVisibilityPolling } = loadTypescript('src/lib/visibilityPolling.ts')
const flush = () => new Promise(resolve => setImmediate(resolve))

function fixture(hidden = false) {
  let listener
  const document = { hidden, addEventListener: (_, fn) => { listener = fn }, removeEventListener: () => { listener = null } }
  const timers = new Map()
  let next = 0
  return { document, timers, change: hidden => { document.hidden = hidden; listener?.() },
    options: { document, intervalMs: 20, maxBackoffMs: 80, random: () => 1,
      schedule: (fn, delay) => { const id = ++next; timers.set(id, { fn, delay }); return id },
      cancel: id => timers.delete(id) } }
}

test('poller pauses hidden tabs, aborts in-flight requests and cleans up', async () => {
  const f = fixture(true)
  let calls = 0
  let signal
  const stop = startVisibilityPolling(async value => { calls++; signal = value }, f.options)
  await flush()
  assert.equal(calls, 0)
  f.change(false)
  await flush()
  assert.equal(calls, 1)
  assert.equal(f.timers.size, 1)
  f.change(true)
  assert.equal(signal.aborted, true)
  assert.equal(f.timers.size, 0)
  stop()
  f.change(false)
  await flush()
  assert.equal(calls, 1)
})

test('poller deduplicates overlapping wakeups and caps exponential backoff', async () => {
  const f = fixture()
  let calls = 0
  let reject
  const stop = startVisibilityPolling(() => { calls++; return new Promise((_, fail) => { reject = fail }) }, f.options)
  await flush()
  f.change(false)
  f.change(false)
  assert.equal(calls, 1)
  reject(new Error('temporary failure'))
  await flush()
  assert.equal([...f.timers.values()][0].delay, 40)
  const timer = [...f.timers.values()][0]
  timer.fn()
  await flush()
  assert.equal(calls, 2)
  reject(new Error('temporary failure'))
  await flush()
  assert.equal([...f.timers.values()][0].delay, 80)
  stop()
})
