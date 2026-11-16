const { test } = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadTypescript } = require('./load-typescript.cjs')

test('landing renders resolved empty lists without a permanent loading state and uses supplied catalog', () => {
  const { default: Landing } = loadTypescript('src/app/LandingClient.tsx', {
    './landing.module.css': {},
    '@/lib/useClientAuthUser': { useClientAuthUser: () => null },
    '@/lib/cloudinary': { getOptimizedImageUrl: url => url },
    '@/components/AdBanner': () => null,
    'next/image': () => null,
    'next/link': ({ children, href }) => React.createElement('a', { href }, children),
  })
  const empty = renderToStaticMarkup(React.createElement(Landing, {
    initialCategories: [], initialFeaturedProducts: [],
  }))
  assert.match(empty, /Everyday Quiet Luxury/)
  assert.doesNotMatch(empty, /Loading|skeleton/i)
  const populated = renderToStaticMarkup(React.createElement(Landing, {
    initialCategories: [{ id: 1, name: 'Women' }],
    initialFeaturedProducts: [{ id: 3, prodName: 'Linen Shirt', prodPrice: 3500, prodImg: '/shirt.jpg' }],
  }))
  assert.match(populated, /Shop Women/)
  assert.match(populated, /Linen Shirt/)
  assert.match(populated, /\/customer\/product\?id=3/)
})
