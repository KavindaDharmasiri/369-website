import { findSkuForSelection } from './variants'

export function selectionForSku(sku: any, specs: { name: string }[]): Record<string, string> | null {
  if (!sku?.isActive) return null
  if (!specs.length) return {}
  const values = String(sku.variantKeys || '').split(', ')
  if (values.length !== specs.length || values.some(value => !value)) return null
  const selected = Object.fromEntries(specs.map((spec, index) => [spec.name, values[index]]))
  return findSkuForSelection([sku], specs, selected) ? selected : null
}

export function skuImageUrls(sku: any, fallback: string[]): string[] {
  try {
    const images = typeof sku?.images === 'string' ? JSON.parse(sku.images) : sku?.images
    if (Array.isArray(images) && images.length && images.every(image => typeof image === 'string' && image.length)) return images
  } catch { /* Preserve product images for malformed legacy data. */ }
  return fallback
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

function offer(priceValue: unknown, url: string, inStock: boolean) {
  if (priceValue == null || priceValue === '') return undefined
  const price = Number(priceValue)
  if (!Number.isFinite(price) || price < 0) return undefined
  return { '@type': 'Offer', url, priceCurrency: 'LKR', price: price.toFixed(2),
    availability: `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}` }
}

// A null SKU list means availability was not verified; omit offers rather than
// advertise an invented in-stock base product. Empty means genuinely SKU-less.
export function buildProductSchema(product: any, canonical: string, skus: any[] | null,
  specs: { name: string }[], images: string[], reviews?: { averageRating: number; reviewCount: number } | null): any {
  const base: any = {
    '@type': 'Product', '@id': `${canonical}#product`, name: String(product.prodName),
    description: String(product.prodDescription || product.prodSubtitle || '').replace(/\s+/g, ' ').trim() || undefined,
    image: images.length ? images : undefined, url: canonical,
  }
  if (reviews && Number.isInteger(reviews.reviewCount) && reviews.reviewCount > 0 &&
      Number.isFinite(reviews.averageRating) && reviews.averageRating >= 1 && reviews.averageRating <= 5) {
    base.aggregateRating = { '@type': 'AggregateRating', ratingValue: reviews.averageRating, reviewCount: reviews.reviewCount }
  }
  if (skus === null) return base
  if (!skus.length) {
    base.offers = offer(product.salePrice ?? product.prodPrice, canonical, product.stockStatus === true)
    return base
  }
  const variants = skus.filter(sku => sku.isActive && selectionForSku(sku, specs) !== null).map(sku => {
    const url = new URL(canonical)
    url.searchParams.set('sku', String(sku.id))
    const selected = selectionForSku(sku, specs)!
    const attributes: Record<string, string> = {}
    for (const [key, value] of Object.entries(selected)) {
      if (/^colou?r$/i.test(key)) attributes.color = value
      if (/^size$/i.test(key)) attributes.size = value
    }
    return { '@type': 'Product', '@id': `${url.href}#product`,
      name: [product.prodName, ...Object.values(selected)].join(' / '),
      sku: sku.skuCode, url: url.href, image: skuImageUrls(sku, images), ...attributes,
      isVariantOf: { '@id': `${canonical}#product` },
      offers: offer(sku.salePrice ?? sku.price, url.href, product.stockStatus === true && sku.stock > 0),
    }
  })
  if (!variants.length) return base
  const variesBy = ['color', 'size'].filter(key => variants.some(variant => key in variant)).map(key => `https://schema.org/${key}`)
  return { ...base, '@type': 'ProductGroup', productGroupID: String(product.id),
    ...(variesBy.length ? { variesBy } : {}), hasVariant: variants }
}
