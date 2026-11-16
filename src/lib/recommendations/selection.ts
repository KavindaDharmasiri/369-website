import { bestDiscountForProduct, buildDiscountInfo } from '@/lib/discounts'
import { rankProducts, scoreProduct } from './scoring'
import type { Catalog, CatalogProduct } from './catalogCache'
import type { SuggestedProduct } from './types'

/**
 * Product selection for the shopping assistant, run in memory over the cached
 * catalogue (no per-request product queries).
 *
 * Every page builds its own *theme* (similar items, checkout add-ons, bestsellers,
 * on sale, a category to discover...). General pages pick a theme at random
 * (weighted per page, never the one just shown there); every list gets light random
 * jitter, cross-page de-duplication, subcategory variety and one "something
 * different" discovery slot — so pages don't repeat each other.
 */

// ---------------------------------------------------------------------------
// Randomness (swappable for deterministic tests)
// ---------------------------------------------------------------------------
let rng: () => number = Math.random
export function setRandomSource(fn?: (() => number) | null) { rng = fn || Math.random }
export function random() { return rng() }

export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function weightedOrder<T extends { weight: number }>(items: T[]): T[] {
  const pool = items.filter(i => i.weight > 0)
  const out: T[] = []
  while (pool.length) {
    const total = pool.reduce((s, i) => s + i.weight, 0)
    let r = rng() * total
    let idx = 0
    for (; idx < pool.length - 1; idx++) { r -= pool[idx].weight; if (r <= 0) break }
    out.push(pool.splice(idx, 1)[0])
  }
  return out
}

function uniq<T>(xs: T[]) { return Array.from(new Set(xs.filter(x => x != null))) as T[] }
function truncate(v: string, n: number) { return v.length > n ? `${v.slice(0, n - 1).trimEnd()}…` : v }
function titleCase(v?: string | null) { const s = (v || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Pred = (p: CatalogProduct) => boolean

export type Pool = {
  match: Pred
  reason: string
  relevance: number
}

export type Theme = {
  key: string
  pools: Pool[]
  /** Copy for general pages; contextual pages keep the rule's own copy. */
  title?: string
  message?: string
  ctaLabel?: string
  ctaHref?: string
}

export type SelectionInput = {
  catalog: Catalog
  pageType: string
  searchQuery: string | null
  sourceProduct: any
  category: { id: number; name: string } | null
  cartCount: number
  excludeIds: number[]
  /** Shown by the previous suggestion (any page): never repeated in general lists. */
  lastShown: Set<number>
  /** Shown earlier in the session: pushed down, not excluded. */
  recentlyShown: Set<number>
  /** Themes recently used on this page type: not repeated back-to-back. */
  recentThemes: string[]
  /** Same page asked again: exclude what was just shown and prefer a different angle. */
  refresh?: boolean
  personal: boolean
  viewed: any[]
  purchases: any[]
  wishlist: any[]
  cart: any[]
  favoriteCategoryIds: number[]
  targetPrice: number | null
  priceMin: number | null
  priceMax: number | null
}

export type SelectionResult = { theme: Theme; products: SuggestedProduct[]; contextual: boolean }

const FILLER = 'You might also like'

// ---------------------------------------------------------------------------
// Display mapping
// ---------------------------------------------------------------------------
export function toSuggested(p: any, reason?: string): SuggestedProduct {
  const price = Number(p.salePrice ?? p.prodPrice ?? 0)
  const original = Number(p.originalPrice ?? p.prodPrice ?? price)
  return {
    id: p.id,
    slug: p.slug ?? null,
    name: p.prodName,
    image: p.prodImg || p.productImages?.[0]?.imageUrl || null,
    price,
    originalPrice: original > price ? original : undefined,
    currency: 'LKR',
    categoryName: p.category?.name ?? p.prodCategoryName ?? null,
    available: p.stockStatus !== false,
    reason,
  }
}

function withPrice(p: CatalogProduct, discounts: any[], reason?: string) {
  const info = buildDiscountInfo(Number(p.prodPrice), bestDiscountForProduct(discounts, p))
  return toSuggested({ ...p, ...info }, reason)
}

/** Display data for specific products (e.g. the shopper's own bag), keeping their order. */
export function describeProducts(catalog: Catalog, ids: number[], reason: string): SuggestedProduct[] {
  return ids.map(id => catalog.byId.get(id)).filter(Boolean).map(p => withPrice(p as CatalogProduct, catalog.discounts, reason))
}

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------
function onSaleMatcher(discounts: any[]): Pred | null {
  const productIds = new Set(discounts.filter(d => d.scope === 'product').map(d => d.productId))
  const subIds = new Set(discounts.filter(d => d.scope === 'subcategory').map(d => d.subCategoryId))
  const catIds = new Set(discounts.filter(d => d.scope === 'category').map(d => d.categoryId))
  if (!productIds.size && !subIds.size && !catIds.size) return null
  return p => productIds.has(p.id) || subIds.has(p.subCategoryId) || catIds.has(p.categoryId)
}

function generalThemes(input: SelectionInput): Theme[] {
  const { catalog, pageType } = input
  const viewedSubs = new Set(input.viewed.map(v => v.subCategoryId))
  const viewedCats = new Set(input.viewed.map(v => v.categoryId))
  const purchaseCats = new Set(input.purchases.map(p => p.product?.categoryId).filter(Boolean))
  const favCats = new Set(input.favoriteCategoryIds)
  const onSale = onSaleMatcher(catalog.discounts)

  const builders: Record<string, () => Theme | null> = {
    for_you: () => {
      if (!input.personal) return null
      const pools: Pool[] = []
      if (viewedSubs.size) pools.push({ match: p => viewedSubs.has(p.subCategoryId), reason: 'Based on your browsing', relevance: 1 })
      if (purchaseCats.size) pools.push({ match: p => purchaseCats.has(p.categoryId), reason: 'Based on your orders', relevance: 0.9 })
      if (favCats.size) pools.push({ match: p => favCats.has(p.categoryId), reason: 'From your favourite categories', relevance: 0.9 })
      if (viewedCats.size) pools.push({ match: p => viewedCats.has(p.categoryId), reason: 'Based on your browsing', relevance: 0.8 })
      return pools.length ? { key: 'for_you', pools, title: 'Picked for you', message: 'Chosen from the styles you have been looking at.' } : null
    },
    bestsellers: () => {
      if (catalog.bestsellerIds.length < 3) return null
      const ids = new Set(catalog.bestsellerIds)
      return { key: 'bestsellers', pools: [{ match: p => ids.has(p.id), reason: 'Bestseller', relevance: 1 }],
        title: 'Bestsellers right now', message: 'The pieces shoppers are buying most at the moment.' }
    },
    most_wished: () => {
      if (catalog.mostWishedIds.length < 3) return null
      const ids = new Set(catalog.mostWishedIds)
      return { key: 'most_wished', pools: [{ match: p => ids.has(p.id), reason: 'Most wished', relevance: 1 }],
        title: 'Most-wished pieces', message: 'The items shoppers are saving to their wishlists the most.' }
    },
    on_sale: () => onSale
      ? { key: 'on_sale', pools: [{ match: onSale, reason: 'On sale', relevance: 1 }],
          title: 'On sale now', message: 'Good pieces at a better price, while the offer lasts.', ctaLabel: 'Shop the sale', ctaHref: '/customer/shop' }
      : null,
    new_in: () => ({ key: 'new_in', pools: [{ match: p => !!p.showInNewArrivals, reason: 'New arrival', relevance: 1 }],
      title: 'Just landed', message: 'Fresh pieces that recently arrived in store.', ctaLabel: 'See new arrivals', ctaHref: '/customer/shop?tab=new' }),
    featured: () => ({ key: 'featured', pools: [{ match: p => !!p.featuredOnHomepage, reason: "Editor's pick", relevance: 1 }],
      title: "Editor's picks", message: 'Hand-picked favourites from our team.' }),
    discover: () => {
      const options = catalog.categories.filter(c => !(input.personal && viewedCats.has(c.id)))
      const cat = shuffle(options.length ? options : catalog.categories)[0]
      if (!cat) return null
      const name = titleCase(cat.name)
      return { key: `discover:${cat.id}`, pools: [{ match: p => p.categoryId === cat.id, reason: `From ${name}`, relevance: 1 }],
        title: `Discover ${name}`, message: `Something new to explore from our ${name} collection.`,
        ctaLabel: `Shop ${name}`, ctaHref: `/customer/category?type=${encodeURIComponent(cat.name.toLowerCase())}` }
    },
  }

  const weights: Record<string, Partial<Record<string, number>>> = {
    home:     { for_you: 4, featured: 3, bestsellers: 3, discover: 3, on_sale: 2, new_in: 1 },
    shop:     { new_in: 4, bestsellers: 3, on_sale: 3, for_you: 3, most_wished: 2, discover: 2 },
    account:  { for_you: 5, bestsellers: 2, new_in: 2, on_sale: 2, discover: 2 },
    cart:     { bestsellers: 3, for_you: 3, on_sale: 3, featured: 2, discover: 1 },
    wishlist: { most_wished: 4, on_sale: 3, bestsellers: 2, featured: 2, discover: 2 },
    other:    { discover: 3, bestsellers: 2, new_in: 2, featured: 2, for_you: 2, on_sale: 1 },
  }
  const w = weights[pageType] || weights.other
  const recent = new Set(input.recentThemes.map(t => t.split(':')[0]))
  const order = weightedOrder(Object.keys(builders).map(key => ({
    key,
    // Never repeat the theme this page just showed (unless nothing else is possible).
    weight: (w[key] || 0) * (recent.has(key) ? 0.05 : 1),
  })))
  return order.map(o => builders[o.key]()).filter(Boolean) as Theme[]
}

function contextualTheme(input: SelectionInput): Theme | null {
  const { pageType, sourceProduct, category, catalog } = input
  switch (pageType) {
    case 'product': {
      if (!sourceProduct) return null
      const price = Number(sourceProduct.prodPrice) || 0
      return { key: 'product_similar', pools: [
        { match: p => p.subCategoryId === sourceProduct.subCategoryId, reason: 'Similar style', relevance: 1 },
        { match: p => p.categoryId === sourceProduct.categoryId && p.subCategoryId !== sourceProduct.subCategoryId, reason: 'Complete the look', relevance: 0.85 },
        ...(price > 0 ? [{ match: (p: CatalogProduct) => p.categoryId === sourceProduct.categoryId && p.prodPrice >= price * 0.7 && p.prodPrice <= price * 1.3, reason: 'Similar price', relevance: 0.7 }] : []),
      ] }
    }
    case 'category': {
      if (!category) return null
      const viewedSubs = new Set(input.viewed.map(v => v.subCategoryId))
      const onSale = onSaleMatcher(catalog.discounts)
      const inCat: Pred = p => p.categoryId === category.id
      return { key: `category:${category.id}`, pools: [
        ...(input.personal && viewedSubs.size ? [{ match: (p: CatalogProduct) => inCat(p) && viewedSubs.has(p.subCategoryId), reason: 'Matches your browsing', relevance: 1 }] : []),
        ...(onSale ? [{ match: (p: CatalogProduct) => inCat(p) && onSale(p), reason: 'On sale', relevance: 0.9 }] : []),
        { match: p => inCat(p) && !!p.showInNewArrivals, reason: `New in ${category.name}`, relevance: 0.85 },
        { match: inCat, reason: `Popular in ${category.name}`, relevance: 0.8 },
      ] }
    }
    case 'search': {
      const q = (input.searchQuery || '').trim().toLowerCase().slice(0, 100)
      if (!q) return null
      const terms = uniq([q, ...q.split(/\s+/).filter(t => t.length >= 3)]).slice(0, 4)
      const hay = (p: CatalogProduct) => [p.prodName, p.prodCategoryName, p.prodSubCategoryName, p.tagsCategory, p.prodSubtitle].filter(Boolean).join(' ').toLowerCase()
      return { key: 'search', pools: [{ match: p => { const h = hay(p); return terms.some(t => h.includes(t)) }, reason: `Matches “${truncate(q, 20)}”`, relevance: 1 }] }
    }
    case 'cart': {
      if (!input.cart.length) return null
      const cats = new Set(input.cart.map(c => c.product?.categoryId))
      const subs = new Set(input.cart.map(c => c.product?.subCategoryId))
      const prices = input.cart.map(c => Number(c.product?.prodPrice)).filter(p => p > 0)
      const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
      return { key: 'cart_pairing', pools: [
        { match: p => cats.has(p.categoryId) && !subs.has(p.subCategoryId), reason: 'Pairs with your bag', relevance: 1 },
        ...(avg > 0 ? [{ match: (p: CatalogProduct) => p.prodPrice <= avg * 0.6, reason: 'Easy add-on', relevance: 0.8 }] : []),
        { match: p => cats.has(p.categoryId), reason: 'Goes with your bag', relevance: 0.7 },
      ] }
    }
    case 'wishlist': {
      if (!input.personal || !input.wishlist.length) return null
      const subs = new Set(input.wishlist.map(w => w.product?.subCategoryId))
      const cats = new Set(input.wishlist.map(w => w.product?.categoryId))
      const onSale = onSaleMatcher(catalog.discounts)
      return { key: 'wishlist_similar', pools: [
        { match: p => subs.has(p.subCategoryId), reason: 'Like items you saved', relevance: 1 },
        ...(onSale ? [{ match: (p: CatalogProduct) => cats.has(p.categoryId) && onSale(p), reason: 'On sale now', relevance: 0.9 }] : []),
        { match: p => cats.has(p.categoryId), reason: 'Inspired by your wishlist', relevance: 0.8 },
      ] }
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Score, filter, diversify
// ---------------------------------------------------------------------------
type Scored = SuggestedProduct & { score: number; subCategoryId?: number; categoryId?: number }

/** Pick `n` items in score order, allowing at most `maxPerSub` per subcategory before topping up. */
export function diversify<T extends { subCategoryId?: number }>(sorted: T[], n: number, maxPerSub = 1): T[] {
  const out: T[] = []
  const used = new Map<number | undefined, number>()
  for (const p of sorted) {
    if (out.length >= n) break
    const c = used.get(p.subCategoryId) || 0
    if (c < maxPerSub) { out.push(p); used.set(p.subCategoryId, c + 1) }
  }
  for (const p of sorted) { if (out.length >= n) break; if (!out.includes(p)) out.push(p) }
  return out
}

function buildList(input: SelectionInput, eligible: CatalogProduct[], theme: Theme, take: number, contextual: boolean): Scored[] {
  // First matching pool wins for each product (pools are ordered by relevance).
  const seen = new Map<number, { row: CatalogProduct; pool: Pool }>()
  for (const pool of theme.pools) for (const row of eligible) if (!seen.has(row.id) && pool.match(row)) seen.set(row.id, { row, pool })

  const viewedIds = new Set(input.viewed.map(v => v.id))
  const viewedSubs = new Set(input.viewed.map(v => v.subCategoryId))
  const purchaseCats = new Set(input.purchases.map(p => p.product?.categoryId).filter(Boolean))
  const favCats = new Set(input.favoriteCategoryIds)

  let scored: Scored[] = Array.from(seen.values()).map(({ row, pool }) => {
    const s = withPrice(row, input.catalog.discounts, pool.reason)
    let priceFit = 0.6
    if (input.targetPrice && input.targetPrice > 0) priceFit = Math.max(0, 1 - Math.min(1, Math.abs(s.price - input.targetPrice) / input.targetPrice))
    else if (input.priceMin != null || input.priceMax != null) {
      priceFit = (input.priceMin == null || s.price >= input.priceMin) && (input.priceMax == null || s.price <= input.priceMax) ? 0.9 : 0.3
    }
    const base = scoreProduct({
      categoryMatch: pool.relevance,
      preferenceMatch: input.personal && (favCats.has(row.categoryId) || purchaseCats.has(row.categoryId)) ? 0.9 : 0.4,
      sizeFit: 0.6,
      priceFit,
      history: !input.personal ? 0.4 : viewedIds.has(row.id) ? 0.15 : viewedSubs.has(row.subCategoryId) ? 0.9 : 0.4,
      purchase: input.personal && purchaseCats.has(row.categoryId) ? 0.8 : 0.25,
      available: row.stockStatus === false ? 0 : 1,
      session: input.recentlyShown.has(row.id) || input.lastShown.has(row.id) ? 0 : 0.9,
    })
    // Pool relevance dominates; jitter adds variety between equally good items; items
    // shown on earlier pages sink (contextual lists only lightly, to stay relevant).
    const penalty = input.lastShown.has(row.id) ? (contextual ? 0.12 : 0.5) : input.recentlyShown.has(row.id) ? (contextual ? 0.06 : 0.2) : 0
    const score = base + pool.relevance * 0.35 + rng() * 0.18 - penalty
    return { ...s, score, subCategoryId: row.subCategoryId, categoryId: row.categoryId }
  })

  // Don't repeat what the previous suggestion just showed. A page's own (contextual)
  // items are kept if they are all it has (e.g. a category with only two products).
  const fresh = scored.filter(p => !input.lastShown.has(p.id))
  if (!contextual && theme.key !== 'popular') scored = fresh
  else if (contextual && input.refresh && fresh.some(p => p.reason !== FILLER)) scored = fresh
  else if (theme.key === 'popular' && fresh.length >= Math.min(3, take)) scored = fresh

  return diversify(rankProducts(scored, scored.length), take, contextual ? 3 : 1)
}

function discoveryPick(input: SelectionInput, eligible: CatalogProduct[], picked: Scored[]): Scored | null {
  const pickedIds = new Set(picked.map(p => p.id))
  const pickedSubs = new Set(picked.map(p => p.subCategoryId))
  const options = eligible.filter(p => !pickedIds.has(p.id) && !pickedSubs.has(p.subCategoryId) && !input.lastShown.has(p.id))
  const row = shuffle(options)[0]
  if (!row) return null
  return { ...withPrice(row, input.catalog.discounts, 'Something different'), score: 0, subCategoryId: row.subCategoryId, categoryId: row.categoryId }
}

export function selectProducts(input: SelectionInput, maxResults = 6): SelectionResult {
  const exclude = new Set(input.excludeIds)
  const eligible = input.catalog.products.filter(p => p.stockStatus !== false && !exclude.has(p.id))

  const themes: Theme[] = []
  const ctxTheme = contextualTheme(input)
  const general = generalThemes(input)
  if (ctxTheme) {
    // Page-specific items always rank first; a low-relevance top-up keeps the list full
    // when the context only has a couple of matches (small category, narrow search).
    ctxTheme.pools.push({ match: () => true, reason: FILLER, relevance: 0.2 })
    themes.push(ctxTheme)
  }
  themes.push(...general)
  themes.push({ key: 'popular', pools: [{ match: () => true, reason: 'Popular now', relevance: 0.5 }],
    title: 'You might like', message: 'A few pieces worth a look.' })

  for (const theme of themes) {
    const contextual = theme === ctxTheme
    const main = buildList(input, eligible, theme, maxResults - 1, contextual)
    // A contextual list is kept if at least one item really matches the page.
    const relevant = contextual ? main.filter(p => p.reason !== FILLER).length : main.length
    if (relevant < (contextual ? 1 : Math.min(3, maxResults - 1)) && theme.key !== 'popular') continue
    if (!main.length) continue
    const discovery = discoveryPick(input, eligible, main)
    // Order for the UI: the 3 best page-relevant items, then one surprise, then the rest.
    const ordered = [...main.slice(0, 3), ...(discovery ? [discovery] : []), ...main.slice(3)]
    return {
      theme,
      contextual,
      products: ordered.slice(0, maxResults).map(({ score: _s, subCategoryId: _sc, categoryId: _c, ...p }) => p),
    }
  }
  return { theme: themes[themes.length - 1], products: [], contextual: false }
}
