/**
 * Maps a URL to the page type used by the suggestion engine. Every shopping page
 * gets its own type so it can receive its own, relevant suggestion.
 */
export function detectPageType(pathname: string, search?: URLSearchParams | { get(name: string): string | null } | null): string {
  if (!pathname) return 'other'
  const p = pathname.toLowerCase()
  const is = (base: string) => p === base || p.startsWith(`${base}/`)
  if (p === '/') return 'home'
  if (is('/admin')) return 'admin'
  if (is('/signin') || is('/signup')) return 'auth'
  if (is('/checkout')) return 'checkout'
  if (is('/customer/cart')) return 'cart'
  if (is('/customer/product')) return 'product'
  if (is('/customer/account/wishlist')) return 'wishlist'
  if (is('/customer/account')) return 'account'
  if (is('/customer/category') || is('/customer/men') || is('/customer/women')) return 'category'
  if (is('/customer/shop')) {
    const q = (search?.get('search') || search?.get('q') || '').trim()
    return q ? 'search' : 'shop'
  }
  return 'other'
}

/** Page types where the assistant is never rendered. */
export const ASSISTANT_HIDDEN_PAGES = ['admin', 'auth', 'checkout']
