export const TAX_RATE = 0.08

export function computeTax(mode: 'percentage' | 'fixed' | string, rate: number, subtotal: number): number {
  if (mode === 'fixed') {
    return fromMinor(moneyMinor(rate))
  }
  if (mode !== 'percentage') throw new Error('Invalid tax mode')
  return fromMinor(percentageMinor(moneyMinor(subtotal), rate))
}
import { fromMinor, moneyMinor, percentageMinor } from './money'
