export const TAX_RATE = 0.08

export function computeTax(mode: 'percentage' | 'fixed' | string, rate: number, subtotal: number): number {
  if (mode === 'fixed') {
    return rate
  }
  return (subtotal * rate) / 100
}
