export type EngagementEventType =
  | 'page_view'
  | 'product_view'
  | 'product_impression'
  | 'scroll_depth'
  | 'active_dwell'
  | 'image_interaction'
  | 'search'
  | 'filter_apply'
  | 'size_select'
  | 'color_select'
  | 'wishlist_add'
  | 'cart_add'
  | 'checkout_view'
  | 'compare_view'
  | 'repeat_view'
  | 'dismissed'
  | 'clicked'
  | 'snoozed'

export type NextActionType =
  | 'view_similar'
  | 'compare_products'
  | 'open_size_guide'
  | 'explore_outfits'
  | 'view_wishlist'
  | 'continue_checkout'
  | 'explore_category'
  | 'ask_assistance'
  | 'save_wishlist'

/**
 * Page types the assistant understands. Each one gets its own rule set,
 * candidate strategy and highlight, so suggestions differ from page to page.
 */
export type PageType =
  | 'home'
  | 'shop'
  | 'search'
  | 'category'
  | 'product'
  | 'cart'
  | 'wishlist'
  | 'account'
  | 'auth'
  | 'checkout'
  | 'admin'
  | 'other'

/** Pages where the assistant must never appear. */
export const SUPPRESSED_PAGE_TYPES: readonly string[] = ['auth', 'checkout', 'admin']

export interface SuggestionRequest {
  sessionId: string
  userId?: number | null
  pageType: string
  pagePath?: string
  productId?: number | null
  /** Product URL identifier as it appears in `?id=` (numeric id or slug). */
  productRef?: string | null
  categoryId?: number | null
  /** Category URL identifier as it appears in `?type=` (name or slug). */
  categoryRef?: string | null
  searchQuery?: string | null
  cartCount?: number
  /** Guest bag contents (logged-in bags are read from the database). */
  cartProductIds?: number[]
  viewedProductIds?: number[]
  recentProductIds?: number[]
  /** How many times the current product was opened in this tab session. */
  productViewCount?: number
  /** Products this tab has already been shown by the assistant (avoid repeating them). */
  excludeProductIds?: number[]
  activeMs?: number
  scrollDepth?: number
  selectedSize?: string | null
  selectedColor?: string | null
  unavailableSelection?: boolean
}

export interface SuggestedProduct {
  id: number
  slug?: string | null
  name: string
  image?: string | null
  price: number
  originalPrice?: number
  currency?: string
  categoryName?: string | null
  available?: boolean
  /** Short, human reason this item is relevant to the current page. */
  reason?: string
}

/** Describes the page a suggestion belongs to, used to highlight it in the UI. */
export interface SuggestionContext {
  pageType: string
  /** Stable key for this page context (e.g. `product:12`, `category:3`, `search:shirt`). */
  contextKey: string
  /** Badge text such as "This product", "Women", "Search: shirt", "Your bag". */
  label: string
  /** Visual accent token, one per page family. */
  accent: 'home' | 'shop' | 'search' | 'category' | 'product' | 'cart' | 'wishlist' | 'account' | 'other'
}

export interface SuggestionResult {
  enabled: boolean
  ruleKey?: string
  action: NextActionType
  title: string
  message: string
  ctaLabel?: string
  ctaHref?: string
  secondaryCtaLabel?: string
  secondaryCtaHref?: string
  products: SuggestedProduct[]
  impressionToken?: string
  cooldownMs?: number
  context?: SuggestionContext
}

export interface ScoringWeights {
  categorySimilarity: number
  preferenceMatch: number
  sizeAvailabilityFit: number
  priceRelevance: number
  browsingHistory: number
  purchaseHistory: number
  availability: number
  sessionActivity: number
}
