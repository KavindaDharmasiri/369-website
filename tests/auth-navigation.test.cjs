const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { loadTypescript } = require('./load-typescript.cjs')
const { authDestination } = loadTypescript('src/lib/authNavigation.ts')

test('auth destinations retain safe local routes and reject external/script/auth-loop redirects', () => {
  assert.equal(authDestination('/customer/cart'), '/customer/cart')
  assert.equal(authDestination('/customer/product?id=3&sku=15'), '/customer/product?id=3&sku=15')
  for (const target of [null, 'javascript:alert(1)', 'https://evil.invalid', '//evil.invalid', '/\\evil.invalid',
    '/signin', '/customer/../signin', '/signup?next=foo', '/bad\npath', '/'.repeat(2001)]) {
    assert.equal(authDestination(target), '/customer/shop')
  }
  assert.equal(authDestination(undefined, 'admin'), '/admin')
})

test('auth success navigates a fresh document without an arbitrary timer or replaying saved bags', () => {
  for (const page of ['signin', 'signup']) {
    const source = fs.readFileSync(`src/app/${page}/page.tsx`, 'utf8')
    assert.match(source, /window\.location\.replace\(authDestination/)
    assert.doesNotMatch(source, /setTimeout|\/api\/cart\/merge|removeItem\(['"]cart['"]\)/)
  }
})
