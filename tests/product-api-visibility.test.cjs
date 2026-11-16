const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')

function fixture({ hidden = false, admin = false, revoked = false } = {}) {
  const db = {
    product: { findUnique: async ({ select }) => {
      const row = { id: 3, prodName: 'Shirt', prodPrice: 100, status: 'ACTIVE', prodMarket: hidden ? 'DRAFT' : 'MARKETPLACE',
        isDeleted: false, stockStatus: true, createdBy: 'private-admin@example.invalid',
        category: { isActive: true }, subCategoryId: 1, subCategory: { isActive: true } }
      return Object.fromEntries(Object.entries(row).filter(([key]) => select[key]))
    } },
    user: { findUnique: async () => ({ id: 1, isActive: true, sessionVersion: revoked ? 1 : 0, userType: admin ? 'admin' : 'customer' }) },
    discount: { findMany: async () => [] },
  }
  const auth = { verifyToken: () => ({ userId: 1, userType: 'admin', sessionVersion: 0 }) }
  return loadTypescript('src/app/api/products/[id]/route.ts', {
    '@/lib/db': db, './db': db, '@/lib/auth': auth, './auth': auth,
    '@/lib/encryption': { encrypt: value => value },
  })
}

test('public product DTO omits internal actor emails and rejects hidden products', async () => {
  const req = new Request('http://localhost/api/products/3')
  const response = await fixture().GET(req, { params: { id: '3' } })
  assert.equal(response.status, 200)
  assert.equal(JSON.parse((await response.json()).data).createdBy, undefined)
  assert.equal((await fixture({ hidden: true }).GET(req, { params: { id: '3' } })).status, 404)
})

test('admin product editing uses current DB permissions, not stale admin JWT claims', async () => {
  const req = new Request('http://localhost/api/products/3', { headers: { Authorization: 'Bearer valid' } })
  assert.equal((await fixture({ hidden: true }).GET(req, { params: { id: '3' } })).status, 404)
  assert.equal((await fixture({ hidden: true, admin: true }).GET(req, { params: { id: '3' } })).status, 200)
  assert.equal((await fixture({ admin: true, revoked: true }).GET(req, { params: { id: '3' } })).status, 401)
})
