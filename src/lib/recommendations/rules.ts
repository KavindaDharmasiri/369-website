import type { NextActionType } from './types'

export interface RuleDefinition {
  key: string
  name: string
  priority: number
  triggerType: string
  /** Minimum time before the same rule is shown again for the same page context. */
  cooldownSeconds: number
  /** Cap across the whole session (all pages). */
  maxPerSession: number
  /** Cap for one page context (one product, one category, one search...). */
  maxPerContext?: number
  /** Allow-list of page types. Omitted means any page that is not suppressed. */
  pages?: string[]
  suppressOnPages?: string[]
  actionType: NextActionType
  condition: (ctx: RuleContext) => boolean
  build: (ctx: RuleContext) => RuleAction
}

export interface RuleContext {
  pageType: string
  productId?: number | null
  productName?: string | null
  categoryId?: number | null
  categoryName?: string | null
  searchQuery?: string | null
  cartCount: number
  activeMs: number
  scrollDepth: number
  repeatViewCount: number
  similarViewedCount: number
  previouslyViewedWithoutAction: boolean
  unavailableSelection: boolean
  inBudgetBrowsing: boolean
  checkoutInactive: boolean
  hasHistory: boolean
  hasWishlist: boolean
  isAuthenticated: boolean
  personalizationEnabled: boolean
}

export interface RuleAction {
  ruleKey: string
  action: NextActionType
  title: string
  message: string
  ctaLabel?: string
  ctaHref?: string
  secondaryCtaLabel?: string
  secondaryCtaHref?: string
}

/** Active time on a page before a page-specific suggestion is offered. */
export const PAGE_DWELL_MS = 4000

const SHOPPING_PAGES = ['home', 'shop', 'search', 'category', 'product', 'cart', 'wishlist', 'account']

function quoted(q?: string | null) {
  const v = (q || '').trim().slice(0, 40)
  return v ? `“${v}”` : 'your search'
}

function titleCase(v?: string | null) {
  const s = (v || '').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function personal(ctx: RuleContext) {
  return ctx.personalizationEnabled && (ctx.hasHistory || ctx.isAuthenticated)
}

export const DEFAULT_RULES: RuleDefinition[] = [
  // ---- Behaviour-driven rules (higher priority) ---------------------------
  {
    key: 'unavailable_size',
    name: 'Unavailable size or variant',
    priority: 95,
    triggerType: 'availability',
    cooldownSeconds: 180,
    maxPerSession: 6,
    maxPerContext: 2,
    pages: ['product'],
    actionType: 'view_similar',
    condition: (ctx) => ctx.unavailableSelection,
    build: (ctx) => ({
      ruleKey: 'unavailable_size',
      action: 'view_similar',
      title: 'Looking for an available option?',
      message: ctx.productName
        ? `That option of ${ctx.productName} may be unavailable. These similar pieces are in stock now.`
        : 'That selection may be unavailable. Here are similar items that are currently available.',
      ctaLabel: 'View alternatives',
    }),
  },
  {
    key: 'repeat_product_view',
    name: 'Repeatedly viewing one product',
    priority: 90,
    triggerType: 'repeat_view',
    cooldownSeconds: 240,
    maxPerSession: 4,
    maxPerContext: 1,
    pages: ['product'],
    actionType: 'open_size_guide',
    condition: (ctx) => ctx.repeatViewCount >= 3 && !!ctx.productId,
    build: (ctx) => ({
      ruleKey: 'repeat_product_view',
      action: 'open_size_guide',
      title: 'Need help choosing?',
      message: `You have come back to ${ctx.productName || 'this item'} a few times. Checking sizes and options may help you decide.`,
      ctaLabel: 'Check sizes & options',
      ctaHref: '#product-options',
      secondaryCtaLabel: ctx.isAuthenticated ? 'Save for later' : 'Sign in to save',
      secondaryCtaHref: ctx.isAuthenticated ? '/customer/account/wishlist' : '/signin',
    }),
  },
  {
    key: 'cart_inactivity',
    name: 'Cart inactivity',
    priority: 88,
    triggerType: 'cart',
    cooldownSeconds: 300,
    maxPerSession: 2,
    pages: ['cart'],
    actionType: 'continue_checkout',
    condition: (ctx) => ctx.checkoutInactive && ctx.cartCount > 0,
    build: (ctx) => ({
      ruleKey: 'cart_inactivity',
      action: 'continue_checkout',
      title: 'Still deciding?',
      message: `Your ${ctx.cartCount} item${ctx.cartCount === 1 ? ' is' : 's are'} saved in your bag. Complete your order now so you don't miss out.`,
      ctaLabel: 'Complete my order',
      ctaHref: '#checkout',
    }),
  },
  {
    key: 'similar_products_compare',
    name: 'Viewing several similar products',
    priority: 85,
    triggerType: 'comparison',
    cooldownSeconds: 900,
    maxPerSession: 1,
    maxPerContext: 1,
    pages: ['product', 'category', 'search'],
    actionType: 'compare_products',
    condition: (ctx) => ctx.similarViewedCount >= 3,
    build: (ctx) => ({
      ruleKey: 'similar_products_compare',
      action: 'compare_products',
      title: 'Comparing options?',
      message: ctx.categoryName
        ? `You have viewed several ${ctx.categoryName} pieces. Here are a few worth comparing side by side.`
        : 'You have viewed several similar items. Here are a few you may want to compare.',
      ctaLabel: 'See options',
    }),
  },
  {
    key: 'returning_product',
    name: 'Returning to previously viewed product',
    priority: 80,
    triggerType: 'return_view',
    cooldownSeconds: 600,
    maxPerSession: 4,
    maxPerContext: 1,
    pages: ['product'],
    actionType: 'save_wishlist',
    condition: (ctx) => ctx.previouslyViewedWithoutAction && !!ctx.productId,
    build: (ctx) => ({
      ruleKey: 'returning_product',
      action: 'save_wishlist',
      title: 'Still interested?',
      message: ctx.isAuthenticated
        ? `You came back to ${ctx.productName || 'this item'}. Save it to your wishlist so it is easy to find later.`
        : `You came back to ${ctx.productName || 'this item'}. Sign in to save it to your wishlist and find it later.`,
      ctaLabel: ctx.isAuthenticated ? 'View wishlist' : 'Sign in to save',
      ctaHref: ctx.isAuthenticated ? '/customer/account/wishlist' : '/signin',
    }),
  },
  {
    key: 'budget_browsing',
    name: 'Browsing within a price range',
    priority: 70,
    triggerType: 'budget',
    cooldownSeconds: 300,
    maxPerSession: 3,
    maxPerContext: 1,
    pages: ['shop', 'search', 'category', 'product'],
    actionType: 'view_similar',
    condition: (ctx) => ctx.inBudgetBrowsing,
    build: () => ({
      ruleKey: 'budget_browsing',
      action: 'view_similar',
      title: 'More in a similar range',
      message: 'Here are relevant items that fit the price range you have been browsing.',
      ctaLabel: 'Explore options',
    }),
  },

  // ---- Page-specific rules: one per page, so every page gets its own suggestion
  {
    // Items left in the bag while browsing elsewhere: remind, with the bag items themselves.
    key: 'bag_waiting',
    name: 'Bag waiting while browsing',
    priority: 65,
    triggerType: 'cart',
    cooldownSeconds: 300,
    maxPerSession: 3,
    maxPerContext: 1,
    pages: ['home', 'shop', 'account'],
    actionType: 'continue_checkout',
    condition: (ctx) => ctx.activeMs >= PAGE_DWELL_MS && ctx.cartCount > 0,
    build: (ctx) => ({
      ruleKey: 'bag_waiting',
      action: 'continue_checkout',
      title: `Your bag is waiting`,
      message: `You have ${ctx.cartCount} item${ctx.cartCount === 1 ? '' : 's'} in your bag. Checkout whenever you are ready.`,
      ctaLabel: 'Go to checkout',
      ctaHref: '/customer/cart',
    }),
  },
  {
    key: 'home_picks',
    name: 'Home page picks',
    priority: 60,
    triggerType: 'page',
    cooldownSeconds: 5, // TESTING (normal: 20)
    maxPerSession: 300,
    maxPerContext: 40,
    pages: ['home'],
    actionType: 'explore_category',
    condition: (ctx) => ctx.activeMs >= PAGE_DWELL_MS,
    build: (ctx) => ({
      ruleKey: 'home_picks',
      action: 'explore_category',
      title: personal(ctx) ? 'Picked for you' : 'Start with our favourites',
      message: personal(ctx)
        ? 'Based on what you have been looking at, these pieces are a good place to start.'
        : 'Our most-loved pieces right now, chosen to get you started.',
      ctaLabel: 'Shop all',
      ctaHref: '/customer/shop',
    }),
  },
  {
    key: 'shop_picks',
    name: 'Shop page picks',
    priority: 60,
    triggerType: 'page',
    cooldownSeconds: 5, // TESTING (normal: 20)
    maxPerSession: 300,
    maxPerContext: 40,
    pages: ['shop'],
    actionType: 'view_similar',
    condition: (ctx) => ctx.activeMs >= PAGE_DWELL_MS,
    build: (ctx) => ({
      ruleKey: 'shop_picks',
      action: 'view_similar',
      title: personal(ctx) ? 'Based on your browsing' : 'Trending right now',
      message: personal(ctx)
        ? 'A few pieces that match the styles you have been exploring.'
        : 'Popular new pieces other shoppers are looking at today.',
      ctaLabel: 'See new arrivals',
      ctaHref: '/customer/shop?tab=new',
    }),
  },
  {
    key: 'search_related',
    name: 'Search results helper',
    priority: 60,
    triggerType: 'page',
    cooldownSeconds: 5, // TESTING (normal: 20)
    maxPerSession: 300,
    maxPerContext: 40,
    pages: ['search'],
    actionType: 'view_similar',
    condition: (ctx) => ctx.activeMs >= PAGE_DWELL_MS,
    build: (ctx) => ({
      ruleKey: 'search_related',
      action: 'view_similar',
      title: `More like ${quoted(ctx.searchQuery)}`,
      message: `Related pieces that match ${quoted(ctx.searchQuery)}, including ones you may have missed.`,
      ctaLabel: 'View top match',
    }),
  },
  {
    key: 'category_picks',
    name: 'Category page picks',
    priority: 60,
    triggerType: 'page',
    cooldownSeconds: 5, // TESTING (normal: 20)
    maxPerSession: 300,
    maxPerContext: 40,
    pages: ['category'],
    actionType: 'explore_category',
    condition: (ctx) => ctx.activeMs >= PAGE_DWELL_MS,
    build: (ctx) => {
      const cat = titleCase(ctx.categoryName)
      return {
        ruleKey: 'category_picks',
        action: 'explore_category',
        title: cat ? `Top picks in ${cat}` : 'Top picks in this collection',
        message: personal(ctx)
          ? `Pieces from ${cat || 'this collection'} that match what you have been browsing.`
          : `Popular and newly added pieces from ${cat || 'this collection'}.`,
        ctaLabel: 'View top pick',
      }
    },
  },
  {
    key: 'product_similar',
    name: 'Product page similar items',
    priority: 60,
    triggerType: 'page',
    cooldownSeconds: 5, // TESTING (normal: 20)
    maxPerSession: 300,
    maxPerContext: 40,
    pages: ['product'],
    actionType: 'view_similar',
    condition: (ctx) => ctx.activeMs >= PAGE_DWELL_MS,
    build: (ctx) => ({
      ruleKey: 'product_similar',
      action: 'view_similar',
      title: ctx.productName ? `Similar to ${ctx.productName}` : 'You may also like',
      message: 'Pieces with a similar style and price, so you can compare before you decide.',
      ctaLabel: 'View similar',
    }),
  },
  {
    // Bag has items: the relevant next step is paying, not more browsing.
    key: 'cart_checkout',
    name: 'Cart: nudge to checkout',
    priority: 62,
    triggerType: 'cart',
    cooldownSeconds: 5, // TESTING (normal: 20)
    maxPerSession: 300,
    maxPerContext: 40,
    pages: ['cart'],
    actionType: 'continue_checkout',
    condition: (ctx) => ctx.activeMs >= PAGE_DWELL_MS && ctx.cartCount > 0,
    build: (ctx) => ({
      ruleKey: 'cart_checkout',
      action: 'continue_checkout',
      title: 'Ready to checkout?',
      message: `You have ${ctx.cartCount} item${ctx.cartCount === 1 ? '' : 's'} in your bag. Review your order summary and place your order — it only takes a minute.`,
      ctaLabel: 'Checkout now',
      ctaHref: '#checkout',
    }),
  },
  {
    key: 'cart_empty_picks',
    name: 'Empty cart picks',
    priority: 60,
    triggerType: 'page',
    cooldownSeconds: 5, // TESTING (normal: 20)
    maxPerSession: 300,
    maxPerContext: 40,
    pages: ['cart'],
    actionType: 'explore_category',
    condition: (ctx) => ctx.activeMs >= PAGE_DWELL_MS && ctx.cartCount === 0,
    build: (ctx) => ({
      ruleKey: 'cart_empty_picks',
      action: 'explore_category',
      title: 'Your bag is empty',
      message: personal(ctx)
        ? 'Pick up where you left off with pieces you have been looking at.'
        : 'Here are a few popular pieces to get you started.',
      ctaLabel: 'Start shopping',
      ctaHref: '/customer/shop',
    }),
  },
  {
    key: 'wishlist_similar',
    name: 'Wishlist similar items',
    priority: 60,
    triggerType: 'page',
    cooldownSeconds: 5, // TESTING (normal: 20)
    maxPerSession: 300,
    maxPerContext: 40,
    pages: ['wishlist'],
    actionType: 'view_similar',
    condition: (ctx) => ctx.activeMs >= PAGE_DWELL_MS,
    build: (ctx) => ({
      ruleKey: 'wishlist_similar',
      action: 'view_similar',
      title: ctx.hasWishlist ? 'Inspired by your wishlist' : 'Start your wishlist',
      message: ctx.hasWishlist
        ? 'Similar styles to the pieces you have saved.'
        : 'Save pieces you love so they are easy to find later. Here are a few ideas.',
      ctaLabel: 'View top pick',
    }),
  },
  {
    key: 'account_picks',
    name: 'Account page picks',
    priority: 60,
    triggerType: 'page',
    cooldownSeconds: 5, // TESTING (normal: 20)
    maxPerSession: 300,
    maxPerContext: 40,
    pages: ['account'],
    actionType: 'explore_category',
    condition: (ctx) => ctx.activeMs >= PAGE_DWELL_MS,
    build: (ctx) => ({
      ruleKey: 'account_picks',
      action: 'explore_category',
      title: 'Picked for you',
      message: personal(ctx)
        ? 'Based on your orders and browsing, you might like these.'
        : 'New pieces you might like.',
      ctaLabel: 'Shop new arrivals',
      ctaHref: '/customer/shop?tab=new',
    }),
  },

  // ---- Generic fallback for pages without their own rule -----------------
  {
    key: 'dwell_no_action',
    name: 'Active browsing without action',
    priority: 50,
    triggerType: 'dwell',
    cooldownSeconds: 300,
    maxPerSession: 2,
    pages: ['other'],
    actionType: 'view_similar',
    condition: (ctx) => ctx.activeMs >= 5000 && ctx.scrollDepth >= 10 && !ctx.previouslyViewedWithoutAction,
    build: () => ({
      ruleKey: 'dwell_no_action',
      action: 'view_similar',
      title: 'Looking for something similar?',
      message: 'Here are a few styles that match what you have been browsing.',
      ctaLabel: 'View similar',
      ctaHref: '/customer/shop',
    }),
  },
]

export function ruleAppliesToPage(rule: RuleDefinition, pageType: string) {
  if ((rule.suppressOnPages || []).includes(pageType)) return false
  if (rule.pages && rule.pages.length) return rule.pages.includes(pageType)
  return SHOPPING_PAGES.includes(pageType) || pageType === 'other'
}
