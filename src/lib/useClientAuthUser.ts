'use client'
import { useMemo, useSyncExternalStore } from 'react'
import { decodeAuthUser, getAuthToken } from './clientAuth'

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener('auth-token-change', onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener('auth-token-change', onChange)
  }
}

const serverSnapshot = (): string | null | undefined => undefined
function clientSnapshot(): string | null | undefined {
  const token = getAuthToken()
  const user = decodeAuthUser(token)
  // Do not briefly render expired identity while navigation catches up.
  if (!user || (typeof user.exp === 'number' && user.exp <= Date.now() / 1000)) return null
  return token
}

/** Browser identity for display only; never an authorization boundary. */
export function useClientAuthUser() {
  const token = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  return useMemo(() => token === undefined ? undefined : decodeAuthUser(token), [token])
}
