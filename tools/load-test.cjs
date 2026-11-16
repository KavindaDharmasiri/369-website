// Safe load/performance probe against an explicitly chosen base URL.
// Default target is the isolated browser fixture (synthetic schema only).
const http = require('node:http')
const https = require('node:https')
const { performance } = require('node:perf_hooks')
const CryptoJS = require('crypto-js')
const { loadEnvConfig } = require('@next/env')

loadEnvConfig(process.cwd())
const base = (process.argv[2] || 'http://127.0.0.1:3102').replace(/\/$/, '')
const durationSec = Number(process.argv[3] || 15)
const concurrency = Number(process.argv[4] || 20)

function pct(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}
function round(n) { return Math.round(n * 100) / 100 }

async function request(path, options = {}) {
  const url = base + path
  const start = performance.now()
  try {
    const res = await fetch(url, { redirect: 'manual', ...options })
    let body = ''
    try { body = await res.text() } catch {}
    const ms = performance.now() - start
    return { ok: res.status >= 200 && res.status < 400, status: res.status, ms, bytes: Buffer.byteLength(body) }
  } catch (error) {
    return { ok: false, status: 0, ms: performance.now() - start, bytes: 0, error: String(error.message || error) }
  }
}

async function login() {
  const key = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY
  if (!key) return { token: null, note: 'encryption key unavailable; authenticated scenarios skipped' }
  const payload = CryptoJS.AES.encrypt(JSON.stringify({
    email: 'browser-fixture@example.invalid', password: 'Fixture-only-pass-369!'
  }), key).toString()
  const res = await request('/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload }),
  })
  try {
    const outer = JSON.parse((await fetch(base + '/api/login', { // not ideal but need body; easier parse from earlier
    })).status && '')
  } catch {}
  return { res }
}

async function getToken() {
  const key = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY
  if (!key) return null
  const payload = CryptoJS.AES.encrypt(JSON.stringify({
    email: 'browser-fixture@example.invalid', password: 'Fixture-only-pass-369!'
  }), key).toString()
  const response = await fetch(base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.data) return null
  try {
    const decrypted = CryptoJS.AES.decrypt(body.data, key).toString(CryptoJS.enc.Utf8)
    const data = JSON.parse(decrypted)
    return typeof data?.token === 'string' ? data.token : null
  } catch { return null }
}

async function runScenario(name, fn, opts = {}) {
  const end = Date.now() + durationSec * 1000
  const results = []
  let inflight = 0
  let started = 0
  const workers = Array.from({ length: opts.concurrency || concurrency }, async () => {
    while (Date.now() < end) {
      started++; inflight++
      try { results.push(await fn()) } finally { inflight-- }
    }
  })
  await Promise.all(workers)
  const times = results.map(r => r.ms)
  const ok = results.filter(r => r.ok).length
  const statuses = {}
  for (const r of results) statuses[r.status] = (statuses[r.status] || 0) + 1
  const errors = [...new Set(results.filter(r => !r.ok).map(r => r.error || r.status))].slice(0, 5)
  return {
    scenario: name, requests: results.length, ok, failed: results.length - ok,
    rps: round(results.length / durationSec),
    min: round(Math.min(...times, 0)), avg: round(times.reduce((s, v) => s + v, 0) / (times.length || 1)),
    p50: round(pct(times, 50)), p95: round(pct(times, 95)), p99: round(pct(times, 99)), max: round(Math.max(...times, 0)),
    statuses, errors,
  }
}

async function main() {
  console.log(JSON.stringify({ base, durationSec, concurrency, note: 'Local synthetic-fixture load probe; not production/Vercel/CDN evidence.' }))
  // warmup
  await request('/api/health/live')
  const token = await getToken()
  const scenarios = [
    ['GET /api/health/live', () => request('/api/health/live'), { concurrency: Math.max(10, concurrency) }],
    ['GET /api/health', () => request('/api/health'), { concurrency: Math.max(10, concurrency) }],
    ['GET / (home)', () => request('/'), { concurrency: Math.min(concurrency, 10) }],
    ['GET /customer/shop', () => request('/customer/shop'), { concurrency: Math.min(concurrency, 10) }],
    ['GET /customer/product?id=1&sku=1', () => request('/customer/product?id=1&sku=1'), { concurrency: Math.min(concurrency, 10) }],
    ['GET /api/products/1', () => request('/api/products/1')],
    ['GET /api/products/search?q=shirt', () => request('/api/products/search?q=shirt')],
    ['GET /sitemap.xml', () => request('/sitemap.xml'), { concurrency: Math.min(concurrency, 10) }],
  ]
  if (token) {
    const auth = { Authorization: `Bearer ${token}` }
    const quoteBody = JSON.stringify({
      email: 'browser-fixture@example.invalid', firstName: 'Browser', lastName: 'Fixture',
      address: 'Fixture street', city: 'City', state: 'Region', zipCode: '00000', phone: '0000000000',
      paymentMethod: 'cash', items: [{ productId: 1, skuId: 1, quantity: 1 }]
    })
    scenarios.push(
      ['POST /api/orders/quote (auth)', () => request('/api/orders/quote', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: quoteBody,
      }), { concurrency: Math.min(concurrency, 8) }],
      ['GET /api/cart (auth)', () => request('/api/cart', { headers: auth })],
    )
  } else {
    console.log(JSON.stringify({ warning: 'No auth token obtained; skipping authenticated scenarios.' }))
  }

  const reports = []
  for (const [name, fn, opts] of scenarios) {
    process.stdout.write(`Running ${name}...\n`)
    reports.push(await runScenario(name, fn, opts || {}))
  }
  console.log(JSON.stringify({ summary: reports }, null, 2))
}

main().catch(error => { console.error(error); process.exit(1) })
