const { test } = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadTypescript } = require('./load-typescript.cjs')

test('loading overlay is present in the initial loading render and absent when idle', () => {
  const { default: LoadingScreen } = loadTypescript('src/components/LoadingScreen.tsx', {
    './LoadingScreen.module.css': {},
  })
  assert.match(renderToStaticMarkup(React.createElement(LoadingScreen, { isLoading: true })), /Loading/)
  assert.equal(renderToStaticMarkup(React.createElement(LoadingScreen, { isLoading: false })), '')
})

test('closed try-on has no mounted session and each garment has a distinct session identity', () => {
  const { default: TryOnModal } = loadTypescript('src/components/TryOnModal.tsx', {
    './TryOnModal.module.css': {}, '@/lib/faceDetection': {}, '@/lib/cloudinary': {},
  })
  const props = { open: false, onClose: () => {}, garmentUrl: '/shirt.jpg', productName: 'Shirt' }
  assert.equal(TryOnModal(props), null)
  assert.equal(TryOnModal({ ...props, open: true }).key, '/shirt.jpg')
  assert.equal(TryOnModal({ ...props, open: true, garmentUrl: '/coat.jpg' }).key, '/coat.jpg')
})

test('category sorting uses displayed sale price without mutating server catalog data', () => {
  const { default: Category } = loadTypescript('src/app/customer/category/CategoryClient.tsx', {
    react: { ...React, useState: initial => React.useState(initial === 'newest' ? 'price_low' : initial) },
    './category.module.css': {}, '@/lib/useClientAuthUser': { useClientAuthUser: () => null },
    '@/lib/cloudinary': { getOptimizedImageUrl: url => url },
    '@/components/CustomerHeader': () => null, '@/components/CustomerFooter': () => null,
    '@/components/Cart': () => null, '@/components/Skeleton': { CardsSkeleton: () => null },
    'next/link': ({ href, children }) => React.createElement('a', { href }, children),
  })
  const products = [
    { id: 1, prodName: 'Expensive', prodPrice: 1000, salePrice: 900 },
    { id: 2, prodName: 'Discounted', prodPrice: 2000, salePrice: 500 },
  ]
  const html = renderToStaticMarkup(React.createElement(Category, { initialType: 'women', initialProducts: products }))
  assert.ok(html.indexOf('Discounted') < html.indexOf('Expensive'))
  assert.deepEqual(products.map(product => product.id), [1, 2])
})
