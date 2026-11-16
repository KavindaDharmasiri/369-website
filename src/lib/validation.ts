export class ValidationError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
    this.name = 'ValidationError'
  }
}

export const MAX_ORDER_LINES = 100
export const MAX_ITEM_QUANTITY = 1000

export function objectValue(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('A JSON object is required')
  }
  return value as Record<string, any>
}

export async function readJsonObject(request: Request): Promise<Record<string, any>> {
  try {
    return objectValue(await request.json())
  } catch (error) {
    if (error instanceof ValidationError) throw error
    throw new ValidationError('Invalid JSON body')
  }
}

export function textValue(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new ValidationError(`${name} is required and must be at most ${maxLength} characters`)
  }
  return value.trim()
}

export function numberValue(value: unknown, name: string): number {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value))) {
    throw new ValidationError(`${name} must be a finite number`)
  }
  return Number(value)
}

export function positiveId(value: unknown, name = 'ID'): number {
  const id = numberValue(value, name)
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
    throw new ValidationError(`${name} must be a positive integer ID`)
  }
  return id
}

export function quantityValue(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_ITEM_QUANTITY) {
    throw new ValidationError(`Quantity must be an integer between 1 and ${MAX_ITEM_QUANTITY}`)
  }
  return value
}

export function parseCartInput(value: unknown) {
  const body = objectValue(value)
  const productId = positiveId(body.productId, 'Product ID')
  const skuId = body.skuId === undefined || body.skuId === null ? null : positiveId(body.skuId, 'SKU ID')
  const quantity = quantityValue(body.quantity === undefined ? 1 : body.quantity)
  let specs: Record<string, string> | null = null
  if (body.specs !== undefined && body.specs !== null) {
    const input = objectValue(body.specs)
    if (Object.keys(input).length > 20) throw new ValidationError('Too many product specifications')
    specs = {}
    for (const key of Object.keys(input).sort()) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new ValidationError('Invalid specification key')
      specs[textValue(key, 'Specification name', 100)] = textValue(input[key], 'Specification value', 256)
    }
  }
  return { productId, skuId, quantity, specs }
}

export function parseOrderInput(value: unknown) {
  const body = objectValue(value)
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_ORDER_LINES) {
    throw new ValidationError(`Order must contain between 1 and ${MAX_ORDER_LINES} items`)
  }
  const items = body.items.map((item: unknown) => {
    const line = objectValue(item)
    return {
      productId: positiveId(line.productId, 'Product ID'),
      skuId: line.skuId === undefined || line.skuId === null ? null : positiveId(line.skuId, 'SKU ID'),
      quantity: quantityValue(line.quantity),
    }
  })
  const email = textValue(body.email, 'Email', 254)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('Invalid email address')
  if (!['cash', 'card'].includes(body.paymentMethod)) throw new ValidationError('Invalid payment method')
  return {
    email,
    firstName: textValue(body.firstName, 'First name', 100),
    lastName: textValue(body.lastName, 'Last name', 100),
    address: textValue(body.address, 'Address', 1000),
    apartment: body.apartment === undefined || body.apartment === null || body.apartment === ''
      ? null : textValue(body.apartment, 'Apartment', 300),
    city: textValue(body.city, 'City', 100),
    state: textValue(body.state, 'State', 100),
    zipCode: textValue(body.zipCode, 'Postal code', 32),
    phone: textValue(body.phone, 'Phone', 100),
    paymentMethod: body.paymentMethod as 'cash' | 'card',
    couponCode: body.couponCode === undefined || body.couponCode === null || body.couponCode === ''
      ? null : textValue(body.couponCode, 'Coupon code', 64).toUpperCase(),
    items,
  }
}
