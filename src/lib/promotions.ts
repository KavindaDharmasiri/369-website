import { numberValue, positiveId, textValue, ValidationError } from './validation'

type RecordInput = Record<string, any>
const MAX_MONEY = 99999999.99

function field(body: RecordInput, existing: RecordInput, key: string, fallback?: any) {
  return body[key] !== undefined ? body[key] : existing[key] !== undefined ? existing[key] : fallback
}

function numericField(body: RecordInput, existing: RecordInput, key: string, fallback?: any) {
  return body[key] !== undefined ? body[key]
    : existing[key] !== undefined && existing[key] !== null ? Number(existing[key]) : fallback
}

function optionalNumber(value: unknown, name: string, integer = false): number | null {
  if (value === undefined || value === null || value === '') return null
  const number = numberValue(value, name)
  if (number < 0 || number > (integer ? 2147483647 : MAX_MONEY) || (integer && !Number.isInteger(number))) {
    throw new ValidationError(`${name} must be a nonnegative ${integer ? 'integer' : 'amount'} within the supported range`)
  }
  return number
}

function optionalDate(value: unknown, name: string): Date | null {
  if (value === undefined || value === null || value === '') return null
  if (!(value instanceof Date) && typeof value !== 'string') throw new ValidationError(`Invalid ${name}`)
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new ValidationError(`Invalid ${name}`)
  return date
}

function commonFields(body: RecordInput, existing: RecordInput) {
  const discountType = field(body, existing, 'discountType', 'percentage')
  const discountValue = numberValue(numericField(body, existing, 'discountValue'), 'Discount value')
  if (!['percentage', 'fixed'].includes(discountType)) throw new ValidationError('Invalid discount type')
  if (discountValue <= 0 || discountValue > MAX_MONEY || (discountType === 'percentage' && discountValue > 100)) {
    throw new ValidationError(discountType === 'percentage'
      ? 'Percentage discount must be greater than 0 and at most 100'
      : 'Discount value must be a positive amount within the supported range')
  }
  const validFrom = optionalDate(field(body, existing, 'validFrom'), 'start date')
  const validUntil = optionalDate(field(body, existing, 'validUntil'), 'end date')
  if (validFrom && validUntil && validFrom > validUntil) throw new ValidationError('End date must not precede start date')
  const isActive = field(body, existing, 'isActive', true)
  if (typeof isActive !== 'boolean') throw new ValidationError('Active status must be a boolean')
  const description = field(body, existing, 'description', null)
  if (description !== null && (typeof description !== 'string' || description.length > 5000)) {
    throw new ValidationError('Description must be at most 5000 characters')
  }
  return { discountType: discountType as 'percentage' | 'fixed', discountValue, validFrom, validUntil, isActive, description }
}

export function discountData(body: RecordInput, existing: RecordInput = {}) {
  const common = commonFields(body, existing)
  const name = textValue(field(body, existing, 'name'), 'Discount name', 200)
  const scope = field(body, existing, 'scope', 'product')
  if (!['product', 'category', 'subcategory'].includes(scope)) throw new ValidationError('Invalid discount scope')
  const targetKey = scope === 'product' ? 'productId' : scope === 'category' ? 'categoryId' : 'subCategoryId'
  const target = positiveId(field(body, existing, targetKey), 'Discount target ID')
  return {
    ...common, name, scope: scope as 'product' | 'category' | 'subcategory',
    productId: scope === 'product' ? target : null,
    categoryId: scope === 'category' ? target : null,
    subCategoryId: scope === 'subcategory' ? target : null,
  }
}

export async function assertDiscountTarget(db: any, data: ReturnType<typeof discountData>) {
  const record = data.scope === 'product'
    ? await db.product.findUnique({ where: { id: data.productId }, select: { id: true } })
    : data.scope === 'category'
      ? await db.category.findUnique({ where: { id: data.categoryId }, select: { id: true } })
      : await db.subCategory.findUnique({ where: { id: data.subCategoryId }, select: { id: true } })
  if (!record) throw new ValidationError('Discount target not found', 404)
}

export function couponData(body: RecordInput, existing: RecordInput = {}) {
  return {
    ...commonFields(body, existing),
    code: textValue(field(body, existing, 'code'), 'Coupon code', 64).toUpperCase(),
    minSubtotal: optionalNumber(numericField(body, existing, 'minSubtotal'), 'Minimum subtotal'),
    maxDiscount: optionalNumber(numericField(body, existing, 'maxDiscount'), 'Maximum discount'),
    maxUses: optionalNumber(numericField(body, existing, 'maxUses'), 'Usage limit', true),
  }
}
