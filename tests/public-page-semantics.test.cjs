const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTypescript } = require('./load-typescript.cjs')

test('shop search and q aliases both produce noindex metadata', async () => {
  const page = loadTypescript('src/app/customer/shop/page.tsx', {
    '@/lib/db': {}, './ShopClient': () => null, '@/lib/siteUrl': { absoluteUrl: path => `https://example.test${path}` },
  })
  for (const searchParams of [{ search: 'shirt' }, { q: 'shirt' }]) {
    const metadata = await page.generateMetadata({ searchParams })
    assert.equal(metadata.robots.index, false)
    assert.equal(metadata.alternates.canonical, 'https://example.test/customer/shop')
  }
  assert.equal((await page.generateMetadata({ searchParams: { tab: 'new' } })).alternates.canonical, 'https://example.test/customer/shop?tab=new')
})

function categoryPage(category) {
  return loadTypescript('src/app/customer/category/page.tsx', {
    '@/lib/db': { category: { findFirst: async () => category } },
    './CategoryClient': () => null,
    '@/lib/siteUrl': { absoluteUrl: path => `https://example.test${path}` },
    '@/lib/slugRedirects': { resolveSlugRedirect: async () => null },
    'next/navigation': {
      notFound: () => { throw new Error('HTTP_NOT_FOUND') },
      redirect: path => { throw new Error(`REDIRECT:${path}`) },
      permanentRedirect: path => { throw new Error(`PERMANENT:${path}`) },
    },
  })
}

test('category page never swallows notFound or permanentRedirect control flow', async () => {
  await assert.rejects(categoryPage(null).default({ searchParams: { type: 'unknown' } }), /HTTP_NOT_FOUND/)
  await assert.rejects(categoryPage(null).default({ searchParams: {} }), /REDIRECT:\/customer\/shop/)
  await assert.rejects(categoryPage({ id: 1, name: 'Women' }).default({ searchParams: { type: 'womens-fashion' } }), /PERMANENT:/)
})

test('category database outage propagates as failure instead of indexing an empty collection', async () => {
  const page = loadTypescript('src/app/customer/category/page.tsx', {
    '@/lib/db': { category: { findFirst: async () => { throw new Error('offline') } } },
    './CategoryClient': () => null, '@/lib/siteUrl': { absoluteUrl: path => path },
    '@/lib/slugRedirects': {},
  })
  await assert.rejects(page.default({ searchParams: { type: 'women' } }), /offline/)
})
