'use client'
import { decryptData } from '@/lib/clientEncryption'

export function parseCartSpecs(value: unknown): Record<string, string> | null {
  try {
    const specs = typeof value === 'string' ? JSON.parse(value) : value
    if (!specs || typeof specs !== 'object' || Array.isArray(specs) || !Object.values(specs).every((entry) => typeof entry === 'string')) return null
    return specs as Record<string, string>
  } catch { return null }
}

export function enrichServerCartItem(item: any) {
  const product = item.product || {}
  const sku = item.sku || null

  let image = product.prodImg
  let price = product.prodPrice
  let originalPrice = product.prodPrice
  let stock = product.stockStatus ? null : 0

  if (sku) {
    price = sku.price
    originalPrice = sku.price
    stock = sku.stock
    if (sku.images) {
      try {
        const imgs = JSON.parse(sku.images)
        if (imgs.length > 0) image = imgs[0]
      } catch {
        // ignore malformed images
      }
    }
  }

  if (item.salePrice !== undefined && item.salePrice !== null) {
    price = item.salePrice
  }
  if (item.originalPrice !== undefined && item.originalPrice !== null) {
    originalPrice = item.originalPrice
  }

  return {
    ...item,
    name: product.prodName || 'Product',
    image,
    price: Number(price),
    originalPrice: Number(originalPrice),
    isOnSale: Number(price) < Number(originalPrice),
    stock,
    specs: parseCartSpecs(item.specs)
  }
}

export async function enrichGuestCartItem(item: any) {
  try {
    const res = await fetch(`/api/products/${item.productId}`)
    const result = await res.json()
    const product = decryptData(result.data)

    let image = product.prodImg
    let price = product.prodPrice
    let originalPrice = product.originalPrice ?? product.prodPrice
    let stock = product.stockStatus ? null : 0

    if (item.skuId) {
      const skuRes = await fetch(`/api/products/${item.productId}/skus`)
      const skuResult = await skuRes.json()
      const skus = decryptData(skuResult.data)
      const sku = skus.find((s: any) => s.id === item.skuId)
      if (sku) {
        price = sku.salePrice ?? sku.price
        originalPrice = sku.originalPrice ?? sku.price
        stock = sku.stock
        if (sku.images) {
          const imgs = JSON.parse(sku.images)
          if (imgs.length > 0) image = imgs[0]
        }
      }
    } else if (product.salePrice !== undefined) {
      price = product.salePrice
    }

    // Local snapshots are presentation hints, never a price authority. Keep the
    // freshly fetched product/SKU price rather than a stale or edited saved value.

    return {
      ...item,
      name: product.prodName,
      image,
      price: Number(price),
      originalPrice: Number(originalPrice),
      isOnSale: Number(price) < Number(originalPrice),
      stock,
      specs: parseCartSpecs(item.specs)
    }
  } catch {
    return item
  }
}
