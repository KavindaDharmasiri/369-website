export interface DiscountInfo {
  originalPrice: number
  salePrice: number
  discountPercent: number
  discountType: string
  discountValue: number
  discountName: string
  isOnSale: boolean
}

export function computeSalePrice(price: number, discount: any): number {
  if (!Number.isFinite(price) || price < 0) throw new Error('Invalid product price')
  const value = Number(discount.discountValue)
  // Legacy invalid promotions must never produce negative prices or surcharges.
  if (!Number.isFinite(value) || value <= 0 || !['percentage', 'fixed'].includes(discount.discountType) ||
      (discount.discountType === 'percentage' && value > 100)) return price
  if (discount.discountType === 'percentage') {
    return fromMinor(discountedMinor(moneyMinor(price), discount.discountValue))
  }
  return fromMinor(Math.max(0, moneyMinor(price) - moneyMinor(discount.discountValue)))
}

export function buildDiscountInfo(price: number, discount: any | null): DiscountInfo {
  const originalPrice = roundMoney(price)
  if (!discount) {
    return { originalPrice, salePrice: originalPrice, discountPercent: 0, discountType: '', discountValue: 0, discountName: '', isOnSale: false }
  }
  const salePrice = computeSalePrice(originalPrice, discount)
  const saved = originalPrice - salePrice
  const discountPercent = originalPrice > 0 ? Math.round((saved / originalPrice) * 100) : 0
  return {
    originalPrice,
    salePrice,
    discountPercent,
    discountType: discount.discountType,
    discountValue: Number(discount.discountValue),
    discountName: discount.name || '',
    isOnSale: salePrice < originalPrice
  }
}

export async function getActiveDiscounts(db: any): Promise<any[]> {
  const now = new Date()
  return db.discount.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] }
      ]
    }
  })
}

export function bestDiscountForProduct(discounts: any[], product: any, price = Number(product.prodPrice)): any | null {
  let candidates: any[] = []

  const productDisc = discounts.filter((d: any) => d.scope === 'product' && d.productId === product.id)
  if (productDisc.length > 0) {
    candidates = productDisc
  } else {
    const subDisc = discounts.filter((d: any) => d.scope === 'subcategory' && d.subCategoryId === product.subCategoryId)
    if (subDisc.length > 0) {
      candidates = subDisc
    } else {
      const catDisc = discounts.filter((d: any) => d.scope === 'category' && d.categoryId === product.categoryId)
      candidates = catDisc
    }
  }

  if (candidates.length === 0) return null
  candidates.sort((a: any, b: any) => computeSalePrice(price, a) - computeSalePrice(price, b))
  return candidates[0]
}

export async function attachDiscountInfo(db: any, products: any[]): Promise<any[]> {
  if (!products || products.length === 0) return products
  const discounts = await getActiveDiscounts(db)
  return products.map((p: any) => {
    const best = bestDiscountForProduct(discounts, p)
    const info = buildDiscountInfo(Number(p.prodPrice), best)
    return { ...p, ...info }
  })
}
import { discountedMinor, fromMinor, moneyMinor, roundMoney } from './money'
