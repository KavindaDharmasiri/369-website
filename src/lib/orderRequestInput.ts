import { parseOrderInput, quantityValue, ValidationError } from './validation'

export function validateOrderRequestKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(value)) {
    throw new ValidationError('A valid Idempotency-Key header (16–128 characters) is required')
  }
  return value
}

// Shared browser/server canonicalization. This module must not import Node crypto.
export function canonicalOrderInput(value: unknown) {
  const input = parseOrderInput(value)
  const combined = new Map<string, typeof input.items[number]>()
  for (const item of input.items) {
    const key = `${item.productId}:${item.skuId ?? 'base'}`
    const previous = combined.get(key)
    combined.set(key, { ...item, quantity: quantityValue(item.quantity + (previous?.quantity ?? 0)) })
  }
  const items = Array.from(combined.values()).sort((a, b) => a.productId - b.productId || (a.skuId ?? 0) - (b.skuId ?? 0))
  return { ...input, items }
}

export function serializeOrderInput(value: unknown): string {
  return JSON.stringify(canonicalOrderInput(value))
}
