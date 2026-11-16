type CartStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export const GUEST_CART_KEY = 'cart'
export const GUEST_CART_RECEIPT_KEY = 'guestCartMigrationPending'
export const GUEST_CART_BATCH_KEY = 'guestCartBatchPending'

export interface GuestTransferResult {
  acknowledged: boolean
  message?: string
  uncertain?: boolean
}

export interface GuestMergeResult {
  migrated: number
  pending: any[]
  message: string
  uncertain: boolean
}

let operationTail: Promise<unknown> = Promise.resolve()

// All application guest-cart writers use this lock. Web Locks also coordinate tabs
// where supported; the promise queue covers concurrent operations in this tab.
export function withGuestCartLock<T>(operation: () => Promise<T> | T): Promise<T> {
  const run = async (): Promise<T> => {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return await navigator.locks.request('369-guest-cart', async () => await operation())
    }
    return await operation()
  }
  const result = operationTail.then(run, run)
  operationTail = result.catch(() => undefined)
  return result
}

export function readGuestCart(storage: CartStorage): any[] {
  return parseGuestCart(storage.getItem(GUEST_CART_KEY))
}

function parseGuestCart(raw: string | null): any[] {
  if (raw === null) return []
  try {
    const cart = JSON.parse(raw)
    if (!Array.isArray(cart)) throw new Error('Not an array')
    return cart
  } catch {
    throw new Error('The saved bag could not be read. It has been left unchanged on this device.')
  }
}

function checkpoint(storage: CartStorage, items: any[]) {
  if (items.length) storage.setItem(GUEST_CART_KEY, JSON.stringify(items))
  else storage.removeItem(GUEST_CART_KEY)
}

export function removeSavedGuestItem(storage: CartStorage, index: number, expectedItem: unknown) {
  const cart = readGuestCart(storage)
  if (!Number.isInteger(index) || index < 0 || index >= cart.length || JSON.stringify(cart[index]) !== JSON.stringify(expectedItem)) {
    throw new Error('The saved bag changed. Refresh it before removing this item.')
  }
  cart.splice(index, 1)
  checkpoint(storage, cart)
  if (cart.length === 0) {
    storage.removeItem(GUEST_CART_RECEIPT_KEY)
    storage.removeItem(GUEST_CART_BATCH_KEY)
  }
  return cart
}

export function guestLineMatches(saved: any, displayed: any): boolean {
  const specs = (value: any) => {
    try {
      const object = typeof value === 'string' ? JSON.parse(value) : value
      return object && typeof object === 'object' && !Array.isArray(object)
        ? JSON.stringify(Object.keys(object).sort().map((key) => [key, object[key]])) : null
    } catch { return String(value) }
  }
  return !!saved && !!displayed && saved.productId === displayed.productId &&
    (saved.skuId ?? null) === (displayed.skuId ?? null) && (saved.quantity ?? 1) === displayed.quantity &&
    specs(saved.specs) === specs(displayed.specs)
}

// Call inside withGuestCartLock. A persisted in-flight receipt prevents automatic
// replay after a crash, lost response, or failed local checkpoint. This is NOT a
// substitute for future server-side idempotent batch merging.
export async function mergeGuestCart(
  storage: CartStorage,
  transfer: (item: any) => Promise<GuestTransferResult>,
  canContinue: () => boolean = () => true,
): Promise<GuestMergeResult> {
  let expectedRaw = storage.getItem(GUEST_CART_KEY)
  let pending = parseGuestCart(expectedRaw)
  let migrated = 0
  const result = (message = '', uncertain = false): GuestMergeResult => ({ migrated, pending: readGuestCart(storage), message, uncertain })
  if (pending.length === 0) {
    storage.removeItem(GUEST_CART_RECEIPT_KEY)
    return result()
  }
  if (storage.getItem(GUEST_CART_RECEIPT_KEY) !== null) {
    return result('A previous import could not be confirmed. Check your account bag before retrying saved items.', true)
  }
  while (pending.length > 0) {
    if (!canContinue()) return result('Your session changed. Saved items remain on this device.')
    if (storage.getItem(GUEST_CART_KEY) !== expectedRaw) return result('The saved bag changed. Reload before continuing the import.')
    const before = expectedRaw
    // Persist before sending: a refresh must not replay a possibly successful POST.
    storage.setItem(GUEST_CART_RECEIPT_KEY, JSON.stringify({ item: pending[0] }))
    let response: GuestTransferResult
    try {
      response = await transfer(pending[0])
    } catch {
      return result('The import response was lost. Check your account bag before retrying saved items.', true)
    }
    if (!response.acknowledged) {
      if (!response.uncertain) storage.removeItem(GUEST_CART_RECEIPT_KEY)
      return result(response.message || 'Saved items could not be imported and remain on this device.', !!response.uncertain)
    }
    if (storage.getItem(GUEST_CART_KEY) !== before) {
      return result('The saved bag changed during import. Nothing new was overwritten; review both bags before retrying.', true)
    }
    pending = pending.slice(1)
    try {
      checkpoint(storage, pending)
      expectedRaw = pending.length ? JSON.stringify(pending) : null
      storage.removeItem(GUEST_CART_RECEIPT_KEY)
    } catch {
      return result('An item was imported but its local receipt could not be saved. Review your account bag before retrying.', true)
    }
    migrated++
  }
  return result()
}

/** Call under withGuestCartLock. A lost reply retries the exact durable server key. */
export async function mergeGuestCartDurably(
  storage: CartStorage, userId: number,
  transfer: (items: any[], key: string) => Promise<{ acknowledged: boolean; requestKey?: string; definitive?: boolean; message?: string }>,
  canContinue: () => boolean = () => true,
): Promise<GuestMergeResult> {
  const raw = storage.getItem(GUEST_CART_KEY)
  const pending = parseGuestCart(raw)
  const result = (message = '', uncertain = false, migrated = 0): GuestMergeResult => ({
    migrated, pending: readGuestCart(storage), message, uncertain,
  })
  if (!Number.isSafeInteger(userId) || userId < 1 || !canContinue()) return result('Please sign in again before importing.')
  if (storage.getItem(GUEST_CART_RECEIPT_KEY)) return result('A legacy import could not be confirmed. Review both bags before continuing.', true)
  const saved = storage.getItem(GUEST_CART_BATCH_KEY)
  let receipt: { version: number; userId: number; key: string; raw: string }
  if (saved) {
    try { receipt = JSON.parse(saved) } catch { return result('The saved import identity could not be read. Keep your saved items.', true) }
    if (receipt?.version !== 1 || receipt.userId !== userId || typeof receipt.raw !== 'string' ||
        typeof receipt.key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(receipt.key)) {
      return result('An earlier import belongs to a different or invalid session. Review both bags.', true)
    }
    if (receipt.raw !== raw) return result('The saved bag changed after an import started. Review both bags; nothing was overwritten.', true)
  } else {
    if (!pending.length) return result()
    // localStorage has no compare-and-swap. Without Web Locks, two tabs could
    // persist different new keys for the same snapshot and both import it.
    if (typeof window !== 'undefined' && (typeof navigator === 'undefined' || !navigator.locks)) {
      return result('This browser cannot safely coordinate a new saved-bag import between tabs. Your saved items were kept; use a browser with Web Locks support.')
    }
    if (pending.length > 100) return result('Import at most 100 saved lines at a time. Saved items were kept.')
    receipt = { version: 1, userId, key: `cart-${crypto.randomUUID()}`, raw: raw! }
    // Persist before any HTTP call. Storage failures prevent sending the import.
    storage.setItem(GUEST_CART_BATCH_KEY, JSON.stringify(receipt))
  }
  let response
  try { response = await transfer(pending, receipt.key) } catch {
    return result('The reply was lost. Retry to confirm the same import without adding it twice.', true)
  }
  if (!response.acknowledged || response.requestKey !== receipt.key) {
    if (response.definitive && storage.getItem(GUEST_CART_BATCH_KEY) === JSON.stringify(receipt)) storage.removeItem(GUEST_CART_BATCH_KEY)
    return result(response.message || 'The import could not be confirmed. Keep the saved bag and retry the same identity.', !response.definitive)
  }
  if (!canContinue() || storage.getItem(GUEST_CART_KEY) !== raw || storage.getItem(GUEST_CART_BATCH_KEY) !== JSON.stringify(receipt)) {
    return result('Your session or saved bag changed. The confirmed import was not replayed or locally overwritten.', true)
  }
  try {
    storage.removeItem(GUEST_CART_KEY)
    storage.removeItem(GUEST_CART_BATCH_KEY)
  } catch {
    return result('The import succeeded but its local checkpoint failed. Its identity was retained where possible.', true)
  }
  return result('', false, pending.length)
}
