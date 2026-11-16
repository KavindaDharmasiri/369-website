const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')

test('Next 16 proxy checks exact public path boundaries and current admin permissions', async () => {
  let checks = 0
  const route = loadTypescript('src/proxy.ts', {
    '@/lib/auth': { verifyToken: () => ({ userId: 1, userType: 'admin' }) },
    '@/lib/apiMiddleware': { loadActiveUser: async () => { checks++; return { userId: 1, userType: 'customer' } } },
  })
  const req = (pathname, token) => ({ url: `http://localhost${pathname}`, nextUrl: { pathname },
    headers: new Headers(token ? { Authorization: 'Bearer valid' } : {}), cookies: { get: () => undefined } })
  assert.equal((await route.proxy(req('/customer/product'))).headers.get('x-middleware-next'), '1')
  assert.equal(checks, 0)
  assert.equal((await route.proxy(req('/customer/product-private'))).headers.get('location'), 'http://localhost/signin')
  assert.equal((await route.proxy(req('/admin/users', true))).headers.get('location'), 'http://localhost/customer/shop')
  assert.equal(checks, 1)
})

test('public metadata accepts promised Next 16 searchParams', async () => {
  const page = loadTypescript('src/app/customer/shop/page.tsx', {
    '@/lib/db': {}, './ShopClient': () => null, '@/lib/siteUrl': { absoluteUrl: path => `https://example.test${path}` },
  })
  const metadata = await page.generateMetadata({ searchParams: Promise.resolve({ search: 'shirt' }) })
  assert.equal(metadata.robots.index, false)
})
