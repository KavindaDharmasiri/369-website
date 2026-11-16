import type { Prisma } from '@prisma/client'
import { getActiveDiscounts } from './discounts'
import { validateCoupon } from './coupons'
import { resolveOrderItems } from './orderItems'
import { fromMinor, moneyMinor, percentageMinor } from './money'
import { ValidationError } from './validation'

export async function calculateCheckout(tx: Prisma.TransactionClient,
  input: { items: { productId: number; skuId: number | null; quantity: number }[]; couponCode: string | null }) {
  const [discounts, activeShipping, settings] = await Promise.all([
    getActiveDiscounts(tx),
    tx.shippingFee.findFirst({ where: { isActive: true }, orderBy: [{ createdAt: 'desc' }, { shipping_fee_id: 'desc' }] }),
    tx.appSetting.findMany(),
  ])
  const items = await resolveOrderItems(tx, input.items, discounts)
  try {
    const subtotalMinor = items.reduce((sum, item) => sum + moneyMinor(item.subtotal), 0)
    const productDiscountMinor = items.reduce((sum, item) => sum +
      (moneyMinor(item.originalPrice) - moneyMinor(item.price)) * item.quantity, 0)
    const shippingMinor = !activeShipping ? 0 : activeShipping.type.toLowerCase() === 'percentage'
      ? percentageMinor(subtotalMinor, activeShipping.value) : moneyMinor(activeShipping.value)
    const map = Object.fromEntries(settings.map(row => [row.key, row.value]))
    const taxMode = map.taxMode || 'percentage'
    if (!['percentage', 'fixed'].includes(taxMode)) throw new Error('Invalid tax configuration')
    const taxRate = map.taxRate ?? '8'
    const taxMinor = taxMode === 'fixed' ? moneyMinor(taxRate) : percentageMinor(subtotalMinor, taxRate)
    let coupon: any = null
    let discountMinor = 0
    if (input.couponCode) {
      const result = await validateCoupon(tx, input.couponCode, fromMinor(subtotalMinor))
      if (!result.valid) throw new ValidationError(result.message || 'Invalid coupon code')
      coupon = result.coupon
      discountMinor = moneyMinor(result.discount ?? 0)
    }
    const totals = {
      subtotal: fromMinor(subtotalMinor), productDiscount: fromMinor(productDiscountMinor),
      shippingFee: fromMinor(shippingMinor), tax: fromMinor(taxMinor), discount: fromMinor(discountMinor),
      total: fromMinor(subtotalMinor - discountMinor + shippingMinor + taxMinor),
    }
    return { items, totals, coupon,
      policy: { version: 1, currency: 'LKR' as const, taxBasis: 'legacy-subtotal-before-coupon', taxMode, taxRate } }
  } catch (error) {
    if (error instanceof ValidationError) throw error
    // Invalid stored configuration and range/decimal errors fail closed. No raw
    // record values or low-level parsing detail leave this calculation boundary.
    throw new ValidationError('Checkout amounts or configuration are outside the supported range', 409)
  }
}

export type CheckoutCalculation = Awaited<ReturnType<typeof calculateCheckout>>

export function pricingSnapshot(calculation: CheckoutCalculation) {
  return {
    policy: calculation.policy, totals: calculation.totals, couponId: calculation.coupon?.id ?? null,
    lines: calculation.items.map(item => ({ productId: item.productId, skuId: item.skuId,
      quantity: item.quantity, price: item.price, originalPrice: item.originalPrice, subtotal: item.subtotal })),
  }
}
