'use client'
import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

const serverSnapshot = (): string | null | undefined => undefined
const clientSnapshot = (): string | null | undefined => sessionStorage.getItem('currentProductId')

export function useCurrentProductId(urlProductId: string | null) {
  const saved = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  return urlProductId || saved
}
