export interface CouponValidationResult {
  valid: boolean
  coupon?: any
  discount?: number
  discountType?: string
  message?: string
}

export async function validateCoupon(
  db: any,
  code: string,
  subtotal: number
): Promise<CouponValidationResult> {
  const normalizedCode = String(code || '').trim().toUpperCase()

  if (!normalizedCode) {
    return { valid: false, message: 'Coupon code is required' }
  }

  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return { valid: false, message: 'Invalid order subtotal' }
  }

  const coupon = await db.coupon.findUnique({ where: { code: normalizedCode } })

  if (!coupon) {
    return { valid: false, message: 'Invalid coupon code' }
  }

  if (!coupon.isActive) {
    return { valid: false, message: 'This coupon is no longer active' }
  }

  const value = Number(coupon.discountValue)
  if (!['percentage', 'fixed'].includes(coupon.discountType) || !Number.isFinite(value) || value <= 0 ||
      (coupon.discountType === 'percentage' && value > 100) ||
      [coupon.minSubtotal, coupon.maxDiscount].some((amount) => amount != null && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) ||
      (coupon.maxUses != null && (!Number.isInteger(coupon.maxUses) || coupon.maxUses < 0))) {
    return { valid: false, message: 'This coupon has an invalid configuration' }
  }

  const now = new Date()
  if (coupon.validFrom && new Date(coupon.validFrom) > now) {
    return { valid: false, message: 'This coupon is not yet valid' }
  }
  if (coupon.validUntil && new Date(coupon.validUntil) < now) {
    return { valid: false, message: 'This coupon has expired' }
  }

  if (coupon.minSubtotal && subtotal < Number(coupon.minSubtotal)) {
    return {
      valid: false,
      message: `Minimum order amount is LKR ${Number(coupon.minSubtotal).toLocaleString()}`
    }
  }

  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, message: 'This coupon has reached its usage limit' }
  }

  const subtotalMinor = moneyMinor(subtotal)
  let discountMinor = 0
  if (coupon.discountType === 'percentage') {
    discountMinor = percentageMinor(subtotalMinor, coupon.discountValue)
    if (coupon.maxDiscount != null && discountMinor > moneyMinor(coupon.maxDiscount)) {
      discountMinor = moneyMinor(coupon.maxDiscount)
    }
  } else {
    discountMinor = moneyMinor(coupon.discountValue)
  }

  discountMinor = Math.min(discountMinor, subtotalMinor)

  return {
    valid: true,
    coupon,
    discount: fromMinor(discountMinor),
    discountType: coupon.discountType
  }
}
import { fromMinor, moneyMinor, percentageMinor } from './money'
