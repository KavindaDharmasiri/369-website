export type GarmentType = 'upper_body' | 'lower_body' | 'dresses' | 'skirt'

const PANTS_KEYWORDS = /\b(trousers?|pants?|jeans?|denim|shorts|chinos?|cargo|joggers?|leggings|tights)\b/i
const SKIRT_KEYWORDS = /\b(skirts?)\b/i
const DRESS_KEYWORDS = /\b(dresses?|gowns?|kaftans?|kurtis?|frocks?|robes?|jumpsuits?|rompers?|lehengas?|sarees?|saris?)\b/i

export function detectGarmentType(
  subCategory?: string | null,
  category?: string | null,
  productName?: string | null
): GarmentType {
  const haystack = [subCategory, category, productName].filter(Boolean).join(' ')
  if (PANTS_KEYWORDS.test(haystack)) return 'lower_body'
  if (SKIRT_KEYWORDS.test(haystack)) return 'skirt'
  if (DRESS_KEYWORDS.test(haystack)) return 'dresses'
  return 'upper_body'
}
