import prisma from '@/lib/db'
import { DEFAULT_RULES, ruleAppliesToPage, type RuleContext, type RuleDefinition } from './rules'
import { describeProducts, selectProducts } from './selection'
import { getCatalog, type Catalog } from './catalogCache'
import {
  SUPPRESSED_PAGE_TYPES,
  type SuggestionContext,
  type SuggestionRequest,
  type SuggestionResult,
} from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_RESULTS = 6
const RECENT_SHOWN_MS = 45 * 60 * 1000
const ACTIONS_WITHOUT_PRODUCTS = ['continue_checkout', 'view_wishlist', 'ask_assistance', 'save_wishlist', 'open_size_guide']

const disabled = (action: SuggestionResult['action'] = 'view_similar'): SuggestionResult =>
  ({ enabled: false, action, title: '', message: '', products: [] })

// ---------------------------------------------------------------------------
// Page context helpers (pure, exported for tests)
// ---------------------------------------------------------------------------

export function normalizePageType(pageType: string | undefined | null, searchQuery?: string | null) {
  const p = (pageType || 'other').toLowerCase()
  if (p === 'shop' && searchQuery && searchQuery.trim()) return 'search'
  return p
}

export function contextKeyFor(pageType: string, opts: { productId?: number | null; categoryId?: number | null; searchQuery?: string | null }) {
  switch (pageType) {
    case 'product': return `product:${opts.productId ?? 'unknown'}`
    case 'category': return `category:${opts.categoryId ?? 'unknown'}`
    case 'search': return `search:${(opts.searchQuery || '').trim().toLowerCase().slice(0, 60)}`
    default: return pageType
  }
}

function truncate(v: string, n: number) {
  return v.length > n ? `${v.slice(0, n - 1).trimEnd()}…` : v
}

export function buildPageContext(pageType: string, contextKey: string, opts: { productName?: string | null; categoryName?: string | null; searchQuery?: string | null }): SuggestionContext {
  const cat = (opts.categoryName || '').trim()
  const catLabel = cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : ''
  switch (pageType) {
    case 'home': return { pageType, contextKey, label: 'Home', accent: 'home' }
    case 'shop': return { pageType, contextKey, label: 'Shop', accent: 'shop' }
    case 'search': return { pageType, contextKey, label: `Search: ${truncate((opts.searchQuery || '').trim(), 24)}`, accent: 'search' }
    case 'category': return { pageType, contextKey, label: catLabel ? `${catLabel} collection` : 'This collection', accent: 'category' }
    case 'product': return { pageType, contextKey, label: opts.productName ? truncate(opts.productName, 28) : 'This product', accent: 'product' }
    case 'cart': return { pageType, contextKey, label: 'Your bag', accent: 'cart' }
    case 'wishlist': return { pageType, contextKey, label: 'Your wishlist', accent: 'wishlist' }
    case 'account': return { pageType, contextKey, label: 'Your account', accent: 'account' }
    default: return { pageType, contextKey, label: 'Suggestions', accent: 'other' }
  }
}

function logContext(log: any): { pageType?: string; contextKey?: string; theme?: string } {
  const c = log?.context
  return c && typeof c === 'object' && !Array.isArray(c) ? c : {}
}

/**
 * Only an explicit Snooze pauses suggestions. Closing with × just hides the current
 * card (the browser decides when to offer fresh ideas again), so suggestions keep
 * coming without a page refresh.
 */
export function isBlockedByUser(logs: any[], _contextKey?: string, now = Date.now()) {
  return logs.some(log => log.status === 'snoozed' && log.snoozedUntil && new Date(log.snoozedUntil).getTime() > now)
}

export function ruleEligible(rule: RuleDefinition, ctx: RuleContext, contextKey: string, logs: any[], now = Date.now(), sessionId?: string, force = false) {
  if (!ruleAppliesToPage(rule, ctx.pageType)) return false
  if (!rule.condition(ctx)) return false
  const sameRule = logs.filter(l => l.ruleKey === rule.key)
  // The per-session cap counts this browser session only, not the whole day.
  const thisSession = sessionId ? sameRule.filter(l => l.sessionId === sessionId) : sameRule
  if (thisSession.length >= rule.maxPerSession) return false
  // An explicit request skips cooldowns for the page's own suggestions only; reminders
  // (bag waiting, comparisons...) keep their limits so "More ideas" brings new ideas.
  if (force && rule.triggerType === 'page') return true
  const sameContext = sameRule.filter(l => logContext(l).contextKey === contextKey)
  if (sameContext.length >= (rule.maxPerContext ?? rule.maxPerSession)) return false
  const latest = sameContext[0]
  if (latest && now - new Date(latest.createdAt).getTime() < rule.cooldownSeconds * 1000) return false
  return true
}

export function pickRule(ctx: RuleContext, contextKey: string, logs: any[], rules: RuleDefinition[] = DEFAULT_RULES, sessionId?: string, force = false) {
  const picked = rules
    .filter(r => ruleEligible(r, ctx, contextKey, logs, Date.now(), sessionId, force))
    .sort((a, b) => b.priority - a.priority)[0]
  if (picked) return picked
  // An explicit request always gets this page's own suggestion (dwell time aside).
  if (force) {
    const relaxed = { ...ctx, activeMs: Math.max(ctx.activeMs, 10000) }
    return rules
      .filter(r => r.triggerType !== 'dwell' && ruleAppliesToPage(r, ctx.pageType) && r.condition(relaxed))
      .sort((a, b) => b.priority - a.priority)[0] || null
  }
  return null
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

function parseList(raw: unknown): string[] {
  if (!raw || typeof raw !== 'string') return []
  try {
    const v = JSON.parse(raw)
    if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean)
  } catch { /* fall through to comma list */ }
  return raw.split(',').map(x => x.trim()).filter(Boolean)
}

const productRefSelect = {
  id: true, prodName: true, prodPrice: true, stockStatus: true, categoryId: true, subCategoryId: true,
  category: { select: { id: true, name: true } },
} as const

async function resolveSourceProduct(req: SuggestionRequest, catalog: Catalog) {
  const ref = (req.productRef || '').trim()
  const numeric = req.productId || (/^[1-9]\d{0,9}$/.test(ref) && Number(ref) <= 2147483647 ? Number(ref) : null)
  if (numeric) {
    const cached = catalog.byId.get(numeric)
    if (cached) return cached
    return prisma.product.findUnique({ where: { id: numeric }, select: productRefSelect }).catch(() => null)
  }
  if (!ref || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ref) || ref.length > 200) return null
  const bySlug = catalog.products.find(p => p.slug === ref)
  if (bySlug) return bySlug
  // Slug column may not be migrated yet; treat that as "unknown product".
  return prisma.product.findFirst({ where: { slug: ref } as any, select: productRefSelect }).catch(() => null)
}

async function resolveCategory(req: SuggestionRequest, sourceProduct: any, catalog: Catalog) {
  if (sourceProduct?.category) return sourceProduct.category as { id: number; name: string }
  if (req.categoryId) return catalog.categories.find(c => c.id === req.categoryId) || null
  const ref = (req.categoryRef || '').trim().toLowerCase()
  if (!ref) return null
  const byName = catalog.categories.find(c => c.name.toLowerCase() === ref)
  if (byName) return byName
  return prisma.category.findFirst({ where: { slug: ref, isActive: true } as any, select: { id: true, name: true } }).catch(() => null)
}

async function loadUserData(userId?: number | null) {
  const empty = { personalizationEnabled: true, preference: null as any, purchases: [] as any[], wishlist: [] as any[], cart: [] as any[] }
  if (!userId) return empty
  const productBits = { select: { id: true, categoryId: true, subCategoryId: true, prodPrice: true } }
  // All in parallel: one round trip instead of four.
  const [preference, purchases, wishlist, cart] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId } }).catch(() => null),
    prisma.orderItem.findMany({ where: { order: { userId } }, include: { product: productBits }, orderBy: { order: { createdAt: 'desc' } }, take: 20 }).catch(() => []),
    // Wishlist and bag are the user's own functional data; they are read even when
    // behavioural personalisation is off, but only used for the matching page.
    prisma.wishlistItem.findMany({ where: { userId }, select: { productId: true, product: productBits } }).catch(() => []),
    prisma.cartItem.findMany({ where: { userId }, select: { productId: true, product: productBits } }).catch(() => []),
  ])
  const personalizationEnabled = preference ? (preference as any).personalizationEnabled !== false : true
  return { personalizationEnabled, preference, purchases: personalizationEnabled ? purchases as any[] : [], wishlist: wishlist as any[], cart: cart as any[] }
}

async function recentSignals(sessionId: string, userId: number | null | undefined) {
  const since = new Date(Date.now() - DAY_MS)
  const who = userId ? { OR: [{ sessionId }, { userId }] } : { sessionId }
  const [events, logs] = await Promise.all([
    prisma.engagementEvent.findMany({ where: { ...who, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 150 }).catch(() => []),
    prisma.recommendationLog.findMany({ where: { ...who, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 100 }).catch(() => []),
  ])
  return { events: events as any[], logs: logs as any[] }
}

function uniq<T>(xs: T[]) { return Array.from(new Set(xs.filter(x => x != null))) as T[] }
function recentlySuggested(set: Set<number>, id: number) { if (set.size < 60) set.add(id) }

function favoriteCategoryIds(preference: any, catalog: Catalog): number[] {
  const raw = parseList(preference?.favoriteCategories)
  if (!raw.length) return []
  const ids = raw.filter(v => /^\d+$/.test(v)).map(Number)
  const names = new Set(raw.filter(v => !/^\d+$/.test(v)).map(v => v.toLowerCase()))
  for (const c of catalog.categories) if (names.has(c.name.toLowerCase())) ids.push(c.id)
  return uniq(ids)
}

const slim = (p: any) => p && ({ id: p.id, categoryId: p.categoryId, subCategoryId: p.subCategoryId, prodPrice: Number(p.prodPrice) })

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function generateSuggestion(req: SuggestionRequest): Promise<SuggestionResult> {
  const searchQuery = (req.searchQuery || '').trim() || null
  const pageType = normalizePageType(req.pageType, searchQuery)
  if (SUPPRESSED_PAGE_TYPES.includes(pageType)) return disabled()

  // One parallel round of reads; the catalogue itself comes from memory.
  const [catalog, user, signals] = await Promise.all([
    getCatalog(prisma),
    loadUserData(req.userId),
    recentSignals(req.sessionId, req.userId),
  ])
  const personal = user.personalizationEnabled
  const logs = signals.logs
  const events = personal ? signals.events : []
  if (isBlockedByUser(logs)) return disabled()

  const sourceProduct = pageType === 'product' ? await resolveSourceProduct(req, catalog) : null
  const category = (pageType === 'category' || pageType === 'product') ? await resolveCategory(req, sourceProduct, catalog) : null

  const cart = req.userId
    ? user.cart
    : uniq(req.cartProductIds || []).slice(0, 50).map(id => catalog.byId.get(id)).filter(Boolean).map((p: any) => ({ productId: p.id, product: slim(p) }))
  const cartIds = cart.map((c: any) => c.productId)
  const cartCount = req.userId ? cart.length : Math.max(cart.length, req.cartCount || 0)
  const wishlistIds = user.wishlist.map((w: any) => w.productId)

  // Behavioural signals: server events + this tab's own list (events flush with a delay).
  const payloadViewed = uniq([...(req.recentProductIds || []), ...(req.viewedProductIds || [])]
    .filter((v: any) => Number.isInteger(v) && v > 0)) as number[]
  const productViews = events.filter(e => e.eventType === 'product_view' && e.productId)
  const viewedIds = personal ? uniq([...productViews.map(e => e.productId as number), ...payloadViewed]).slice(0, 30) : []
  const viewed = viewedIds.map(id => slim(catalog.byId.get(id))).filter(Boolean) as any[]

  const productId = sourceProduct?.id ?? null
  const serverViews = productId ? productViews.filter(e => e.productId === productId).length : 0
  const repeatViewCount = productId ? Math.max(serverViews, Math.trunc(req.productViewCount || 0), 1) : 0
  const actedOn = !!productId && (
    cartIds.includes(productId) || wishlistIds.includes(productId) ||
    events.some(e => ['cart_add', 'wishlist_add'].includes(e.eventType) && e.productId === productId))
  const previouslyViewedWithoutAction = !!productId && repeatViewCount >= 2 && !actedOn

  const contextCategoryId = category?.id ?? null
  const similarViewedCount = contextCategoryId
    ? viewed.filter(v => v.categoryId === contextCategoryId).length
    : pageType === 'search' ? viewed.length : 0

  const viewedPrices = viewed.map(v => Number(v.prodPrice)).filter(p => p > 0).sort((a, b) => a - b)
  const inBudgetBrowsing = viewedPrices.length >= 3 && viewedPrices[viewedPrices.length - 1] / viewedPrices[0] <= 1.35
  const budgetTarget = inBudgetBrowsing ? viewedPrices[Math.floor(viewedPrices.length / 2)] : null

  const unavailableSelection = !!req.unavailableSelection || (pageType === 'product' && sourceProduct?.stockStatus === false)
  const checkoutInactive = pageType === 'cart' && (req.activeMs || 0) >= 45000 && cartCount > 0

  const ctx: RuleContext = {
    pageType,
    productId,
    productName: sourceProduct?.prodName ?? null,
    categoryId: contextCategoryId,
    categoryName: category?.name ?? null,
    searchQuery,
    cartCount,
    activeMs: req.activeMs || 0,
    scrollDepth: req.scrollDepth || 0,
    repeatViewCount,
    similarViewedCount,
    previouslyViewedWithoutAction,
    unavailableSelection,
    inBudgetBrowsing,
    checkoutInactive,
    hasHistory: personal && (events.length > 0 || viewed.length > 0 || user.purchases.length > 0),
    hasWishlist: wishlistIds.length > 0,
    isAuthenticated: !!req.userId,
    personalizationEnabled: personal,
  }

  const contextKey = contextKeyFor(pageType, { productId, categoryId: contextCategoryId, searchQuery })
  const rule = pickRule(ctx, contextKey, logs, DEFAULT_RULES, req.sessionId, !!req.userRequested)
  if (!rule) return disabled()

  // Products shown by the previous suggestion (on any page) are not repeated, and older
  // ones are pushed down, so moving between pages shows new items instead of the same few.
  const now = Date.now()
  const clientShown = (req.excludeProductIds || []).filter(id => Number.isInteger(id))
  const lastShown = new Set<number>(clientShown.slice(-4))
  const recentlyShown = new Set<number>(clientShown)
  const lastLog = logs
    .filter(l => Array.isArray(l.productIds))
    .reduce<any>((best, l) => !best || new Date(l.createdAt).getTime() > new Date(best.createdAt).getTime() ||
      (new Date(l.createdAt).getTime() === new Date(best.createdAt).getTime() && l.id > best.id) ? l : best, null)
  if (lastLog && now - new Date(lastLog.createdAt).getTime() < RECENT_SHOWN_MS) {
    for (const id of (lastLog.productIds as unknown[]).slice(0, 4)) if (Number.isInteger(id)) lastShown.add(id as number)
  }
  for (const log of logs) {
    if (now - new Date(log.createdAt).getTime() > RECENT_SHOWN_MS) break
    if (Array.isArray(log.productIds)) for (const id of log.productIds) if (Number.isInteger(id)) recentlySuggested(recentlyShown, id)
  }
  // Asking again on the same page means "show me something new".
  const refresh = !!req.refresh || !!req.userRequested || (!!lastLog && logContext(lastLog).contextKey === contextKey)
  const recentThemes = logs
    .filter(l => logContext(l).pageType === pageType && logContext(l).theme)
    .slice(0, 2)
    .map(l => String(logContext(l).theme))

  const selection = selectProducts({
    catalog,
    pageType,
    searchQuery,
    sourceProduct,
    category,
    cartCount,
    excludeIds: uniq([...(productId ? [productId] : []), ...cartIds, ...(pageType === 'wishlist' ? wishlistIds : [])]),
    lastShown,
    recentlyShown,
    recentThemes,
    refresh,
    personal,
    viewed,
    purchases: user.purchases,
    wishlist: user.wishlist,
    cart,
    favoriteCategoryIds: personal ? favoriteCategoryIds(user.preference, catalog) : [],
    targetPrice: pageType === 'product' && sourceProduct ? Number(sourceProduct.prodPrice) : budgetTarget,
    priceMin: personal && user.preference?.priceMin != null ? Number(user.preference.priceMin) : null,
    priceMax: personal && user.preference?.priceMax != null ? Number(user.preference.priceMax) : null,
  }, MAX_RESULTS)
  const theme = selection.theme
  let products = selection.products

  // Checkout nudges: show the bag itself (elsewhere) or at most two small add-ons (on the cart page).
  if (rule.key === 'bag_waiting') {
    products = describeProducts(catalog, cartIds.slice(0, 3), 'In your bag')
  } else if (rule.actionType === 'continue_checkout') {
    products = products.slice(0, 2).map(p => ({ ...p, reason: 'Add before you pay' }))
  }

  if (!products.length && !ACTIONS_WITHOUT_PRODUCTS.includes(rule.actionType)) return disabled(rule.actionType)

  const built = rule.build(ctx)
  // General pages take their headline from the theme actually used (bestsellers, on
  // sale, discover...). Pages with their own context (a category, a product, a search)
  // keep their own headline whenever their own items were found.
  const action = rule.triggerType === 'page' && theme.title && !selection.contextual
    ? { ...built, title: theme.title, message: theme.message || built.message,
        ctaLabel: theme.ctaLabel || built.ctaLabel, ctaHref: theme.ctaHref || built.ctaHref }
    : built
  const context = buildPageContext(pageType, contextKey, { productName: ctx.productName, categoryName: ctx.categoryName, searchQuery })
  const result: SuggestionResult = {
    enabled: true,
    ruleKey: action.ruleKey,
    action: action.action,
    title: action.title,
    message: action.message,
    ctaLabel: action.ctaLabel,
    ctaHref: action.ctaHref,
    secondaryCtaLabel: action.secondaryCtaLabel,
    secondaryCtaHref: action.secondaryCtaHref,
    products,
    cooldownMs: rule.cooldownSeconds * 1000,
    context,
  }

  try {
    const log = await prisma.recommendationLog.create({
      data: {
        sessionId: req.sessionId,
        userId: req.userId || null,
        ruleKey: result.ruleKey || rule.key,
        actionType: result.action,
        pagePath: req.pagePath || null,
        context: { pageType, contextKey, theme: theme.key, productId, categoryId: contextCategoryId, searchQuery } as any,
        productIds: products.map(p => p.id) as any,
        status: 'shown',
      },
    })
    result.impressionToken = String(log.id)
  } catch {
    // Best-effort logging; still return the suggestion.
  }

  return result
}
