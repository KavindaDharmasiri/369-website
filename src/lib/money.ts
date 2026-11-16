export type DecimalInput = string | number | { toString(): string }
export const MAX_MONEY_MINOR = 9999999999

function ratio(value: DecimalInput): [bigint, bigint] {
  const raw = String(value).trim()
  if (raw.length > 100) throw new Error('Invalid decimal amount')
  const match = /^\+?(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(raw)
  if (!match) throw new Error('Invalid nonnegative decimal amount')
  const exponent = Number(match[3] || 0)
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 20) throw new Error('Decimal exponent outside supported range')
  const fraction = match[2] || ''
  const coefficient = BigInt(match[1] + fraction)
  const scale = fraction.length - exponent
  if (Math.abs(scale) > 40) throw new Error('Decimal scale outside supported range')
  return scale >= 0 ? [coefficient, BigInt(10) ** BigInt(scale)] : [coefficient * (BigInt(10) ** BigInt(-scale)), BigInt(1)]
}

function rounded(numerator: bigint, denominator: bigint): number {
  const value = (numerator * BigInt(2) + denominator) / (denominator * BigInt(2))
  if (value < BigInt(0) || value > BigInt(MAX_MONEY_MINOR)) throw new Error('Amount outside supported money range')
  return Number(value)
}

export function moneyMinor(value: DecimalInput): number {
  const [numerator, denominator] = ratio(value)
  return rounded(numerator * BigInt(100), denominator)
}

export function fromMinor(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY_MINOR) throw new Error('Amount outside supported money range')
  return value / 100
}

export function roundMoney(value: DecimalInput): number { return fromMinor(moneyMinor(value)) }

export function percentageMinor(amount: number, rate: DecimalInput): number {
  fromMinor(amount)
  const [numerator, denominator] = ratio(rate)
  return rounded(BigInt(amount) * numerator, denominator * BigInt(100))
}

// Round the discounted unit price, not the independently rounded savings, to
// preserve the existing discount policy at half-cent boundaries.
export function discountedMinor(amount: number, percentage: DecimalInput): number {
  fromMinor(amount)
  const [numerator, denominator] = ratio(percentage)
  if (numerator > BigInt(100) * denominator) throw new Error('Invalid percentage')
  return rounded(BigInt(amount) * (BigInt(100) * denominator - numerator), BigInt(100) * denominator)
}

export function lineAmount(price: DecimalInput, quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Invalid quantity')
  return fromMinor(moneyMinor(price) * quantity)
}

export function sumMoney(values: DecimalInput[]): number {
  return fromMinor(values.reduce((sum: number, value: DecimalInput) => sum + moneyMinor(value), 0))
}
