/**
 * Page tips: action-oriented suggestions built from the live page ("fill in your
 * delivery details", "choose a size", "place your order"...). They run in the
 * browser because only the page knows which fields are filled, which size is
 * picked, and so on. The shopping assistant mixes them with product suggestions.
 */

export type TipStep = { label: string; detail?: string; state: 'done' | 'current' | 'todo' }

export type PageTip = {
  kind: 'tip'
  key: string
  /** Higher = more useful right now. */
  priority: number
  icon: 'form' | 'payment' | 'order' | 'coupon' | 'size' | 'bag' | 'heart' | 'tryon' | 'reviews' | 'filter' | 'search' | 'orders' | 'address' | 'account'
  title: string
  message: string
  ctaLabel: string
  /** Scroll to and highlight this element id... */
  targetId?: string
  /** ...and put the cursor in this element (or the first empty field inside targetId). */
  focus?: 'first-empty' | string
  /** Or navigate. */
  href?: string
  /** Checkout progress shown as a checklist. */
  steps?: TipStep[]
}

const byId = (id: string) => (typeof document === 'undefined' ? null : document.getElementById(id))

function visible(el: Element | null): el is HTMLElement {
  if (!el) return false
  const r = (el as HTMLElement).getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

function labelFor(input: HTMLInputElement): string {
  const group = input.closest('div')
  const label = group?.querySelector('label')?.textContent?.trim()
  return label || input.placeholder || input.name || 'field'
}

/** Required, editable text fields in the delivery form, and which are still empty. */
export function deliveryFieldState(): { empty: { input: HTMLInputElement; label: string }[]; total: number } {
  const form = byId('checkout-delivery')
  if (!form) return { empty: [], total: 0 }
  const inputs = Array.from(form.querySelectorAll<HTMLInputElement>('input'))
    .filter(i => !i.readOnly && !i.disabled && i.type !== 'checkbox' && i.type !== 'radio' && i.type !== 'hidden')
    .filter(i => !/optional/i.test(i.placeholder || '') && !/optional/i.test(labelFor(i)))
  return { empty: inputs.filter(i => !i.value.trim()).map(i => ({ input: i, label: labelFor(i) })), total: inputs.length }
}

/** Where the shopper is in checkout, as a checklist. Null when not on a cart with items. */
export function checkoutProgress(cartCount?: number): { steps: TipStep[]; empty: { input: HTMLInputElement; label: string }[]; total: number; payment: string } | null {
  const place = byId('checkout-place-order') as HTMLButtonElement | null
  if (!place || !byId('checkout-delivery')) return null
  const count = cartCount || Number(byId('checkout')?.getAttribute('data-assist-count') || 0)
  if (!count) return null // empty bag: nothing to check out
  const { empty, total } = deliveryFieldState()
  const payment = byId('checkout-payment')?.getAttribute('data-assist-payment') || ''
  const deliveryDone = total > 0 && empty.length === 0
  const paymentLabel = payment === 'card' ? 'Card on delivery' : payment === 'cash' ? 'Cash on delivery' : 'Choose a method'
  const steps: TipStep[] = [
    { label: 'Bag', detail: `${count} item${count === 1 ? '' : 's'}`, state: 'done' },
    { label: 'Delivery details', detail: deliveryDone ? 'Complete' : `${total - empty.length} of ${total} filled`, state: deliveryDone ? 'done' : 'current' },
    { label: 'Payment', detail: paymentLabel, state: deliveryDone ? (payment ? 'done' : 'current') : 'todo' },
    { label: 'Place order', state: deliveryDone && payment ? 'current' : 'todo' },
  ]
  return { steps, empty, total, payment }
}

function listLabels(labels: string[]) {
  const l = labels.map(s => s.replace(/\s*\(.*\)\s*$/, ''))
  if (l.length <= 2) return l.join(' and ')
  return `${l.slice(0, 2).join(', ')} and ${l.length - 2} more`
}

// ---------------------------------------------------------------------------
// Tips per page
// ---------------------------------------------------------------------------

function cartTips(cartCount: number): PageTip[] {
  const progress = checkoutProgress(cartCount)
  if (!progress) return []
  const { steps, empty, payment } = progress
  const tips: PageTip[] = []
  if (empty.length) {
    tips.push({
      kind: 'tip', key: 'checkout_delivery', priority: 100, icon: 'form', steps,
      title: 'Next step: your delivery details',
      message: `Add your ${listLabels(empty.map(e => e.label.toLowerCase()))} so we know where to send your order.`,
      ctaLabel: empty.length === 1 ? `Fill in ${empty[0].label.toLowerCase()}` : 'Fill delivery details',
      targetId: 'checkout-delivery', focus: 'first-empty',
    })
  } else {
    tips.push({
      kind: 'tip', key: 'checkout_place', priority: 95, icon: 'order', steps,
      title: 'All set — place your order',
      message: `Delivery details are complete and you are paying ${payment === 'card' ? 'by card on delivery' : 'cash on delivery'}. Review the summary and place your order.`,
      ctaLabel: 'Go to Place Order',
      targetId: 'checkout-place-order',
    })
    tips.push({
      kind: 'tip', key: 'checkout_payment', priority: 70, icon: 'payment', steps,
      title: 'How would you like to pay?',
      message: `${payment === 'card' ? 'Card on delivery' : 'Cash on delivery'} is selected. You can switch to ${payment === 'card' ? 'cash' : 'card'} — you pay when the order arrives either way.`,
      ctaLabel: 'Review payment',
      targetId: 'checkout-payment',
    })
  }
  const coupon = byId('checkout-coupon') as HTMLInputElement | null
  if (coupon && coupon.getAttribute('data-assist-coupon') !== 'applied' && !coupon.value.trim()) {
    tips.push({
      kind: 'tip', key: 'checkout_coupon', priority: 55, icon: 'coupon', steps,
      title: 'Have a coupon code?',
      message: 'Add it before you place your order to get your discount.',
      ctaLabel: 'Enter coupon',
      targetId: 'checkout-coupon', focus: 'checkout-coupon',
    })
  }
  const save = byId('saveAddress') as HTMLInputElement | null
  if (save && !save.checked && !empty.length) {
    tips.push({
      kind: 'tip', key: 'checkout_save_address', priority: 40, icon: 'address', steps,
      title: 'Save this address?',
      message: 'Tick "Save this address" and your next checkout will be filled in for you.',
      ctaLabel: 'Show me',
      targetId: 'saveAddress',
    })
  }
  return tips
}

function productTips(isLoggedIn: boolean): PageTip[] {
  const tips: PageTip[] = []
  const specs = Array.from(document.querySelectorAll<HTMLElement>('[data-assist="spec"]'))
  const missing = specs.filter(s => s.getAttribute('data-assist-selected') !== 'true').map(s => s.getAttribute('data-assist-name') || 'option')
  if (missing.length) {
    tips.push({
      kind: 'tip', key: 'product_choose_options', priority: 90, icon: 'size',
      title: `Choose your ${listLabels(missing.map(m => m.toLowerCase()))}`,
      message: 'Pick your options first — then you can add this piece to your bag.',
      ctaLabel: `Choose ${missing[0].toLowerCase()}`,
      targetId: 'product-options',
    })
  } else if (visible(byId('product-add-to-bag'))) {
    tips.push({
      kind: 'tip', key: 'product_add_to_bag', priority: 85, icon: 'bag',
      title: specs.length ? 'Great choice — add it to your bag' : 'Like it? Add it to your bag',
      message: 'Add it now and check out whenever you are ready.',
      ctaLabel: 'Go to Add to Bag',
      targetId: 'product-add-to-bag',
    })
  }
  if (visible(byId('product-try-on'))) {
    tips.push({
      kind: 'tip', key: 'product_try_on', priority: 75, icon: 'tryon',
      title: 'See it on you',
      message: 'Use the virtual try-on to see how this piece looks before you buy.',
      ctaLabel: 'Try it on',
      targetId: 'product-try-on',
    })
  }
  const wish = byId('product-wishlist')
  if (wish && wish.getAttribute('data-assist-active') !== 'true') {
    tips.push({
      kind: 'tip', key: 'product_wishlist', priority: 50, icon: 'heart',
      title: 'Not ready yet?',
      message: isLoggedIn ? 'Tap the heart to save it to your wishlist and come back later.' : 'Sign in and tap the heart to save it for later.',
      ctaLabel: 'Save for later',
      targetId: 'product-wishlist',
    })
  }
  const reviews = byId('product-reviews')
  const count = Number(reviews?.getAttribute('data-assist-count') || 0)
  if (reviews && count > 0) {
    tips.push({
      kind: 'tip', key: 'product_reviews', priority: 45, icon: 'reviews',
      title: `${count} customer review${count === 1 ? '' : 's'}`,
      message: 'See what other shoppers say about fit and quality.',
      ctaLabel: 'Read reviews',
      targetId: 'product-reviews',
    })
  }
  return tips
}

function categoryTips(): PageTip[] {
  const tips: PageTip[] = []
  if (byId('category-filters')) {
    tips.push({
      kind: 'tip', key: 'category_filter', priority: 50, icon: 'filter',
      title: 'Narrow it down',
      message: 'Use the filters to show just one type of piece, like shirts or trousers.',
      ctaLabel: 'Show filters',
      targetId: 'category-filters',
    })
  }
  if (byId('category-sort')) {
    tips.push({
      kind: 'tip', key: 'category_sort', priority: 45, icon: 'filter',
      title: 'Shopping to a budget?',
      message: 'Sort by price to see the most affordable pieces first.',
      ctaLabel: 'Sort by price',
      targetId: 'category-sort', focus: 'category-sort',
    })
  }
  return tips
}

function searchInputId(): string | null {
  const input = document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="Search" i], input[placeholder*="search" i]')
  if (!input) return null
  if (!input.id) input.id = 'site-search'
  return input.id
}

function searchTips(query: string): PageTip[] {
  const id = searchInputId()
  return id ? [{
    kind: 'tip', key: 'search_refine', priority: 45, icon: 'search',
    title: `Not quite “${query.slice(0, 24)}”?`,
    message: 'Try a different word, a colour or a type of piece, like “linen shirt”.',
    ctaLabel: 'Search again',
    targetId: id, focus: id,
  }] : []
}

function shopTips(): PageTip[] {
  const id = searchInputId()
  return id ? [{
    kind: 'tip', key: 'shop_search', priority: 35, icon: 'search',
    title: 'Looking for something specific?',
    message: 'Search by name, colour or type to find it faster.',
    ctaLabel: 'Search the store',
    targetId: id, focus: id,
  }] : []
}

function accountTips(pathname: string): PageTip[] {
  const tips: PageTip[] = []
  if (!pathname.startsWith('/customer/account/orders')) {
    tips.push({ kind: 'tip', key: 'account_orders', priority: 50, icon: 'orders',
      title: 'Track your orders', message: 'See the status and details of everything you have ordered.',
      ctaLabel: 'View my orders', href: '/customer/account/orders' })
  }
  if (!pathname.startsWith('/customer/account/addresses')) {
    tips.push({ kind: 'tip', key: 'account_address', priority: 45, icon: 'address',
      title: 'Faster checkout next time', message: 'Save a delivery address and checkout fills it in for you.',
      ctaLabel: 'Manage addresses', href: '/customer/account/addresses' })
  }
  return tips
}

function wishlistTips(): PageTip[] {
  return [{ kind: 'tip', key: 'wishlist_buy', priority: 50, icon: 'bag',
    title: 'Ready to buy a favourite?', message: 'Open a saved piece, choose your size and add it to your bag.',
    ctaLabel: 'See my saved pieces', targetId: 'main-content' }]
}

function homeTips(isLoggedIn: boolean): PageTip[] {
  return isLoggedIn ? [] : [{ kind: 'tip', key: 'home_signin', priority: 40, icon: 'account',
    title: 'Sign in for a better experience', message: 'Save favourites to your wishlist, track orders and check out faster.',
    ctaLabel: 'Sign in', href: '/signin' }]
}

export function getPageTips(opts: { pageType: string; pathname: string; searchQuery?: string | null; cartCount: number; isLoggedIn: boolean }): PageTip[] {
  if (typeof document === 'undefined') return []
  let tips: PageTip[] = []
  switch (opts.pageType) {
    case 'cart': tips = cartTips(opts.cartCount); break
    case 'product': tips = productTips(opts.isLoggedIn); break
    case 'category': tips = categoryTips(); break
    case 'search': tips = searchTips(opts.searchQuery || ''); break
    case 'shop': tips = shopTips(); break
    case 'account': tips = accountTips(opts.pathname); break
    case 'wishlist': tips = wishlistTips(); break
    case 'home': tips = homeTips(opts.isLoggedIn); break
  }
  // Only tips whose target is actually on the page (or that navigate).
  return tips.filter(t => t.href || (t.targetId && byId(t.targetId)) || t.targetId === 'main-content')
    .sort((a, b) => b.priority - a.priority)
}

/**
 * How often a page shows a tip instead of products. The cart with items is all about
 * finishing the order, so it always shows checkout tips.
 */
export const TIP_SHARE: Record<string, number> = {
  cart: 1, product: 0.5, account: 0.6, wishlist: 0.4, category: 0.35, search: 0.3, shop: 0.3, home: 0.25, other: 0,
}

/** Scroll to a tip's target, highlight it, and put the cursor where typing should start. */
export function runTipAction(tip: PageTip, highlightClass: string): boolean {
  if (tip.href) return false
  let target = tip.targetId === 'main-content'
    ? (document.querySelector('main') || document.body.firstElementChild) as HTMLElement | null
    : byId(tip.targetId || '')
  if (!target) return false
  let focusEl: HTMLElement | null = null
  if (tip.focus === 'first-empty') focusEl = deliveryFieldState().empty[0]?.input || null
  else if (tip.focus) focusEl = byId(tip.focus)
  const scrollTo = focusEl || target
  scrollTo.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target.classList.add(highlightClass)
  setTimeout(() => target?.classList.remove(highlightClass), 2600)
  if (focusEl) setTimeout(() => focusEl?.focus({ preventScroll: true }), 450)
  return true
}
