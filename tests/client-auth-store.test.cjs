const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')

test('display claims tolerate malformed tokens and decode Unicode without verification claims', () => {
  const { decodeAuthUser } = loadTypescript('src/lib/clientAuth.ts')
  assert.equal(decodeAuthUser(null), null)
  assert.equal(decodeAuthUser('broken'), null)
  assert.equal(decodeAuthUser(`header.${Buffer.from('true').toString('base64url')}.signature`), null)
  const claims = { userId: 4, name: 'ආයුබෝවන්', userType: 'customer' }
  const token = `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`
  assert.deepEqual(decodeAuthUser(token), claims)
})

test('client auth store distinguishes hydration from signed-out and cleans up subscriptions', () => {
  let store
  let token = null
  const listeners = new Map()
  const originalWindow = global.window
  global.window = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name) },
  }
  try {
    const { useClientAuthUser } = loadTypescript('src/lib/useClientAuthUser.ts', {
      react: {
        useSyncExternalStore: (subscribe, snapshot, serverSnapshot) => {
          store = { subscribe, snapshot, serverSnapshot }
          return snapshot()
        },
        useMemo: fn => fn(),
      },
      './clientAuth': { getAuthToken: () => token, decodeAuthUser: value => value === 'expired'
        ? { exp: 1 } : value ? { token: value } : null },
    })
    assert.equal(useClientAuthUser(), null)
    assert.equal(store.serverSnapshot(), undefined)
    let changes = 0
    const unsubscribe = store.subscribe(() => changes++)
    token = 'new-token'
    listeners.get('auth-token-change')()
    listeners.get('storage')()
    assert.equal(changes, 2)
    assert.deepEqual(useClientAuthUser(), { token: 'new-token' })
    token = 'expired'
    assert.equal(useClientAuthUser(), null)
    unsubscribe()
    assert.equal(listeners.size, 0)
  } finally {
    if (originalWindow === undefined) delete global.window
    else global.window = originalWindow
  }
})
