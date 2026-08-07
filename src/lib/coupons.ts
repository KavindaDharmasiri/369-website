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

  const coupon = await db.coupon.findUnique({ where: { code: normalizedCode } })

  if (!coupon) {
    return { valid: false, message: 'Invalid coupon code' }
  }

  if (!coupon.isActive) {
    return { valid: false, message: 'This coupon is no longer active' }
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

  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, message: 'This coupon has reached its usage limit' }
  }

  let discount = 0
  if (coupon.discountType === 'percentage') {
    discount = (subtotal * Number(coupon.discountValue)) / 100
    if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) {
      discount = Number(coupon.maxDiscount)
    }
  } else {
    discount = Number(coupon.discountValue)
  }

  if (discount > subtotal) {
    discount = subtotal
  }

  return {
    valid: true,
    coupon,
    discount: Math.round(discount * 100) / 100,
    discountType: coupon.discountType
  }
}
