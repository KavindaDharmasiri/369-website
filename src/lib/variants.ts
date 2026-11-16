export function findSkuForSelection<T extends { isActive: boolean; variantKeys?: string | null }>(
  skus: T[], specs: { name: string }[], selected: Record<string, string>
): T | null {
  if (specs.length === 0 || !specs.every((spec) => selected[spec.name])) return null
  // SKU generation stores values in specification order, not click/insertion order.
  const variantKeys = specs.map((spec) => selected[spec.name]).join(', ')
  return skus.find((sku) => sku.isActive && sku.variantKeys === variantKeys) || null
}
