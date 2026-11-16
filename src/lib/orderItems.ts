import type { Prisma } from '@prisma/client'
import { bestDiscountForProduct, computeSalePrice } from './discounts'
import { parseOrderInput, quantityValue, ValidationError } from './validation'
import { lineAmount, roundMoney } from './money'

type OrderInput = ReturnType<typeof parseOrderInput>

export async function resolveOrderItems(tx: Prisma.TransactionClient, input: OrderInput['items'], discounts: any[]) {
  const combined = new Map<string, OrderInput['items'][number]>()
  for (const item of input) {
    const key = `${item.productId}:${item.skuId ?? 'base'}`
    const previous = combined.get(key)
    combined.set(key, { ...item, quantity: quantityValue(item.quantity + (previous?.quantity ?? 0)) })
  }

  const resolved = []
  // Deterministic ordering reduces lock-order conflicts when reserving shared SKUs.
  const items = Array.from(combined.values()).sort((a, b) => (a.skuId ?? 0) - (b.skuId ?? 0) || a.productId - b.productId)
  const skuIds = items.flatMap(item => item.skuId === null ? [] : [item.skuId])
  const [products, skus] = await Promise.all([
    tx.product.findMany({
      where: { id: { in: [...new Set(items.map(item => item.productId))] } },
      select: {
        id: true, prodName: true, prodPrice: true, status: true, prodMarket: true,
        isDeleted: true, stockStatus: true, categoryId: true, subCategoryId: true,
        category: { select: { isActive: true } },
        subCategory: { select: { isActive: true, categoryId: true } },
        _count: { select: { productSkus: true } },
      },
    }),
    skuIds.length ? tx.productSku.findMany({ where: { id: { in: [...new Set(skuIds)] } },
      select: { id: true, productId: true, skuCode: true, price: true, stock: true, isActive: true, variantKeys: true } }) : Promise.resolve([]),
  ])
  const productsById = new Map(products.map(product => [product.id, product]))
  const skusById = new Map(skus.map(sku => [sku.id, sku]))
  for (const item of items) {
    const product = productsById.get(item.productId)
    if (!product || product.isDeleted || product.status !== 'ACTIVE' || !['MARKETPLACE', 'BOTH'].includes(product.prodMarket) ||
        !product.category.isActive || !product.subCategory.isActive || product.subCategory.categoryId !== product.categoryId) {
      throw new ValidationError(`Product ${item.productId} not found or unavailable`, 404)
    }
    if (!product.stockStatus) throw new ValidationError(`Product ${item.productId} is out of stock`, 409)
    if (product._count.productSkus > 0 && item.skuId === null) {
      throw new ValidationError(`Please select a variant for ${product.prodName}`)
    }

    const sku = item.skuId === null ? null : skusById.get(item.skuId)
    if (item.skuId !== null && (!sku || !sku.isActive || sku.productId !== product.id)) {
      throw new ValidationError(`SKU ${item.skuId} not found for this product`, 404)
    }
    if (sku && sku.stock < item.quantity) throw new ValidationError(`Insufficient stock for SKU ${sku.id}`, 409)
    const originalPrice = roundMoney(sku ? sku.price : product.prodPrice)
    if (!Number.isFinite(originalPrice) || originalPrice < 0) throw new Error('Invalid stored product price')
    const discount = bestDiscountForProduct(discounts, product, originalPrice)
    const price = discount ? computeSalePrice(originalPrice, discount) : originalPrice
    resolved.push({
      productId: product.id, skuId: sku?.id ?? null, quantity: item.quantity,
      productName: product.prodName,
      specs: sku ? JSON.stringify({ variant: sku.variantKeys || sku.skuCode }) : null,
      price, originalPrice, subtotal: lineAmount(price, item.quantity),
    })
  }
  return resolved
}

export async function reserveOrderStock(tx: Prisma.TransactionClient, items: Awaited<ReturnType<typeof resolveOrderItems>>) {
  for (const item of items) {
    if (item.skuId === null) continue
    const result = await tx.productSku.updateMany({
      where: { id: item.skuId, productId: item.productId, isActive: true, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    })
    if (result.count !== 1) throw new ValidationError(`Insufficient stock for SKU ${item.skuId}. Please refresh your cart.`, 409)
  }
}
