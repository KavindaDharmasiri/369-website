let memoSessionId: string | null = null

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Stable per-tab id for guests and logged-in users alike. The value is memoised so
 * `useSyncExternalStore` always gets the same snapshot, even when storage is blocked
 * (private mode), which previously produced a new id on every call.
 */
export function getOrCreateEngagementSessionId(): string {
  if (typeof window === 'undefined') return ''
  if (memoSessionId) return memoSessionId
  const key = 'engagementSessionId'
  try {
    let id = sessionStorage.getItem(key)
    if (!id) {
      id = newId('es')
      sessionStorage.setItem(key, id)
    }
    memoSessionId = id.slice(0, 64)
  } catch {
    memoSessionId = newId('es')
  }
  return memoSessionId
}

export function getGuestEngagementId(): string {
  if (typeof window === 'undefined') return 'guest'
  const key = 'guestEngagementId'
  try {
    let id = localStorage.getItem(key)
    if (!id) {
      id = newId('eg')
      localStorage.setItem(key, id)
    }
    return id.slice(0, 64)
  } catch {
    return getOrCreateEngagementSessionId()
  }
}

const PRODUCT_VIEWS_KEY = 'engagementProductViews'

/** Counts distinct visits to a product in this tab session (not re-renders). */
export function recordProductVisit(productId: number): number {
  if (typeof window === 'undefined' || !Number.isInteger(productId)) return 0
  try {
    const raw = sessionStorage.getItem(PRODUCT_VIEWS_KEY)
    const map: Record<string, number> = raw ? JSON.parse(raw) : {}
    const next = (Number(map[productId]) || 0) + 1
    map[productId] = next
    const keys = Object.keys(map)
    if (keys.length > 60) delete map[keys[0]]
    sessionStorage.setItem(PRODUCT_VIEWS_KEY, JSON.stringify(map))
    return next
  } catch {
    return 1
  }
}

export function getProductVisitCount(productId: number | null | undefined): number {
  if (typeof window === 'undefined' || !productId) return 0
  try {
    const raw = sessionStorage.getItem(PRODUCT_VIEWS_KEY)
    return raw ? Number(JSON.parse(raw)[productId]) || 0 : 0
  } catch {
    return 0
  }
}
