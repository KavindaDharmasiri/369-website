import { serializeOrderInput, validateOrderRequestKey } from './orderRequestInput'

type AttemptStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
interface Attempt { key: string; fingerprint: string }
const storageKey = (userId: number) => `orderAttempt:${userId}`

export class PendingCheckoutError extends Error {}

function assertUserId(userId: number) {
  if (!Number.isInteger(userId) || userId < 1) throw new Error('Please sign in again before checkout.')
}

export function readOrderAttempt(storage: AttemptStorage, userId: number): Attempt | null {
  assertUserId(userId)
  const raw = storage.getItem(storageKey(userId))
  if (raw === null) return null
  try {
    const attempt = JSON.parse(raw)
    validateOrderRequestKey(attempt.key)
    if (typeof attempt.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(attempt.fingerprint)) throw new Error('Invalid hash')
    return { key: attempt.key, fingerprint: attempt.fingerprint }
  } catch {
    throw new PendingCheckoutError('The saved checkout identity is unreadable. Check My Orders before recovering this device with support.')
  }
}

export async function browserOrderFingerprint(input: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure browser storage/cryptography is required for checkout.')
  const bytes = new TextEncoder().encode(serializeOrderInput(input))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

let preparationTail: Promise<unknown> = Promise.resolve()
export async function prepareOrderAttempt(
  storage: AttemptStorage, userId: number, input: unknown,
  fingerprint = browserOrderFingerprint,
  createKey = () => crypto.randomUUID(),
): Promise<Attempt> {
  assertUserId(userId)
  const hash = await fingerprint(input)
  const operation = () => {
    const previous = readOrderAttempt(storage, userId)
    if (previous) {
      if (previous.fingerprint !== hash) throw new PendingCheckoutError('An earlier checkout is unconfirmed. Resolve it before changing this order.')
      return previous
    }
    const key = validateOrderRequestKey(createKey())
    const attempt = { key, fingerprint: hash }
    storage.setItem(storageKey(userId), JSON.stringify(attempt))
    return attempt
  }
  const run = async () => typeof navigator !== 'undefined' && navigator.locks
    ? await navigator.locks.request(`369-order-attempt-${userId}`, operation)
    : operation()
  const result = preparationTail.then(run, run)
  preparationTail = result.catch(() => undefined)
  return result
}

export function clearOrderAttempt(storage: AttemptStorage, userId: number, expectedKey: string) {
  const previous = readOrderAttempt(storage, userId)
  if (previous?.key === expectedKey) storage.removeItem(storageKey(userId))
}
