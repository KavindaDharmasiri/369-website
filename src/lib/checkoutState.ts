export function paymentLabel(status: string): string {
  switch (String(status).toUpperCase()) {
    case 'PAID': return 'paid'
    case 'REFUNDED': return 'refunded'
    case 'CANCELLED': return 'cancelled'
    default: return 'payment not confirmed'
  }
}

export function orderConfirmationText(input: {
  total: number; itemSavings: number; discount: number; couponCode?: string;
  paymentMethod: string;
  delivery: { firstName: string; lastName: string; address: string; apartment: string; city: string; state: string; zipCode: string; phone: string }
}) {
  const d = input.delivery
  return [
    `Total Amount: LKR ${input.total.toFixed(2)}`,
    ...(input.itemSavings > 0 ? [`Item Discounts: -LKR ${input.itemSavings.toFixed(2)}`] : []),
    ...(input.discount > 0 ? [`Coupon Discount: -LKR ${input.discount.toFixed(2)} (${input.couponCode || ''})`] : []),
    `Payment Method: ${input.paymentMethod === 'card' ? 'Card on Delivery' : 'Cash on Delivery'}`,
    'Delivery Address:', `${d.firstName} ${d.lastName}`,
    `${d.address}${d.apartment ? ', ' + d.apartment : ''}`,
    `${d.city}, ${d.state} ${d.zipCode}`, d.phone,
  ].join('\n')
}

const TOTAL_KEYS = ['subtotal', 'productDiscount', 'shippingFee', 'tax', 'discount', 'total'] as const
export type CheckoutTotals = Record<(typeof TOTAL_KEYS)[number], number>
export type CheckoutQuote = { quoteToken: string; expiresAt: string; totals: CheckoutTotals }

// Compares exact minor units so harmless floating-point noise never prompts a
// review, while any real one-cent change does.
export function checkoutTotalsDiffer(displayed: CheckoutTotals, quoted: CheckoutTotals): boolean {
  return TOTAL_KEYS.some(key => Math.round(Number(displayed[key]) * 100) !== Math.round(Number(quoted[key]) * 100))
}

export function parseCheckoutQuote(value: unknown): CheckoutQuote {
  const data = value as { quoteToken?: unknown; expiresAt?: unknown; totals?: Record<string, unknown> } | null
  if (!data || typeof data.quoteToken !== 'string' || !data.quoteToken || data.quoteToken.length > 2048 ||
      typeof data.expiresAt !== 'string' || Number.isNaN(Date.parse(data.expiresAt))) {
    throw new Error('A current checkout quote could not be read. Nothing was ordered.')
  }
  const totals = {} as CheckoutTotals
  for (const key of TOTAL_KEYS) {
    const amount = Number(data.totals?.[key])
    if (!Number.isFinite(amount) || amount < 0) throw new Error('A current checkout quote could not be read. Nothing was ordered.')
    totals[key] = amount
  }
  return { quoteToken: data.quoteToken, expiresAt: data.expiresAt, totals }
}

export function quoteChangeText(previousTotal: number, quotedTotal: number): string {
  return [
    `The total changed from LKR ${previousTotal.toFixed(2)} to LKR ${quotedTotal.toFixed(2)}.`,
    'Prices, stock, shipping, tax or coupon eligibility changed while you were checking out.',
    'Nothing has been ordered yet. Confirm the new total to place this order, or cancel and review your bag.',
  ].join('\n')
}

// Start all resources immediately, but wait for every one to settle before exposing
// checkout or enabling retry. An early failure must not leave old loaders racing retry.
export async function loadCheckoutResources(loaders: (() => Promise<unknown>)[]) {
  const results = await Promise.allSettled(loaders.map((load) => Promise.resolve().then(load)))
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (failure) throw failure.reason
}
