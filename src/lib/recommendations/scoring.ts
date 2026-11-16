import type { ScoringWeights, SuggestedProduct } from './types'

export const DEFAULT_WEIGHTS: ScoringWeights = {
  categorySimilarity: 0.22,
  preferenceMatch: 0.16,
  sizeAvailabilityFit: 0.12,
  priceRelevance: 0.12,
  browsingHistory: 0.14,
  purchaseHistory: 0.1,
  availability: 0.08,
  sessionActivity: 0.06,
}

export function clamp01(v: number) { return Math.max(0, Math.min(1, v)) }

export function scoreProduct(input: {
  categoryMatch: number
  preferenceMatch: number
  sizeFit: number
  priceFit: number
  history: number
  purchase: number
  available: number
  session: number
  weights?: Partial<ScoringWeights>
}) {
  const w = { ...DEFAULT_WEIGHTS, ...(input.weights || {}) }
  const raw =
    w.categorySimilarity * clamp01(input.categoryMatch) +
    w.preferenceMatch * clamp01(input.preferenceMatch) +
    w.sizeAvailabilityFit * clamp01(input.sizeFit) +
    w.priceRelevance * clamp01(input.priceFit) +
    w.browsingHistory * clamp01(input.history) +
    w.purchaseHistory * clamp01(input.purchase) +
    w.availability * clamp01(input.available) +
    w.sessionActivity * clamp01(input.session)
  return Math.round(raw * 1000) / 1000
}

export function rankProducts<T extends SuggestedProduct & { score?: number }>(items: T[], limit = 6) {
  return [...items]
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.price - b.price || a.id - b.id)
    .slice(0, limit)
}
