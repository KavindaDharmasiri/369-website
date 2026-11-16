/** Only local, non-auth destinations; never pass storage content to router.push. */
export function authDestination(candidate: unknown, userType: unknown = 'customer'): string {
  const fallback = userType === 'admin' ? '/admin' : '/customer/shop'
  if (typeof candidate !== 'string' || candidate.length > 2000 || !candidate.startsWith('/') ||
      candidate.startsWith('//') || /[\u0000-\u0020\\]/.test(candidate)) return fallback
  const url = new URL(candidate, 'https://local.invalid')
  if (url.origin !== 'https://local.invalid' || /^\/(signin|signup)(\/|$)/.test(url.pathname)) return fallback
  return `${url.pathname}${url.search}${url.hash}`
}
