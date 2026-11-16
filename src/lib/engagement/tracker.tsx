'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { getOrCreateEngagementSessionId } from './session'
import { detectPageType } from './pageType'

type TrackPayload = {
  eventType: string
  pagePath?: string
  pageType?: string
  productId?: number | null
  categoryId?: number | null
  searchQuery?: string | null
  activeMs?: number
  scrollDepth?: number
  metadata?: Record<string, any>
}

/** Details a page knows about itself (e.g. the numeric id behind a slug URL). */
export type PageContextInfo = {
  productId?: number | null
  productName?: string | null
  categoryId?: number | null
  categoryName?: string | null
}

type EngagementContextValue = {
  sessionId: string
  pageType: string
  routeKey: string
  track: (payload: TrackPayload) => void
  getSnapshot: () => { activeMs: number; maxScroll: number; viewedProductIds: number[] }
  setPageContext: (info: PageContextInfo) => void
  getPageContext: () => PageContextInfo & { routeKey: string }
}

const EngagementContext = createContext<EngagementContextValue | null>(null)

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
const subscribeSession = () => () => {}
const serverSessionId = () => ''

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('authToken')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

export function EngagementProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const search = searchParams?.toString() || ''
  const routeKey = `${pathname}?${search}`
  const pageType = useMemo(() => detectPageType(pathname, new URLSearchParams(search)), [pathname, search])
  const sessionId = useSyncExternalStore(subscribeSession, getOrCreateEngagementSessionId, serverSessionId)

  const sessionIdRef = useRef(sessionId)
  const pageTypeRef = useRef(pageType)
  const queueRef = useRef<any[]>([])
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeStartRef = useRef<number>(0)
  const activeAccumRef = useRef<number>(0)
  const visibleRef = useRef<boolean>(true)
  const maxScrollRef = useRef<number>(0)
  const viewedProductsRef = useRef<number[]>([])
  const pageContextRef = useRef<PageContextInfo & { routeKey: string }>({ routeKey })
  const lastRouteRef = useRef<{ routeKey: string; pageType: string } | null>(null)
  // Layout effects run before any child's passive effects, so children always
  // track events against the current page type and session id.
  useIsoLayoutEffect(() => {
    sessionIdRef.current = sessionId
    pageTypeRef.current = pageType
  }, [sessionId, pageType])

  // Stable callbacks (read live values from refs) so effects don't re-run and
  // duplicate page views / reset timers when the session id hydrates.
  const flush = useCallback(async () => {
    const sid = sessionIdRef.current
    if (typeof window === 'undefined' || !sid) return
    const events = queueRef.current.splice(0, 25)
    if (!events.length) return
    try {
      await fetch('/api/recommendations/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ sessionId: sid, events }),
        keepalive: true,
      })
    } catch {
      // best effort
    }
    if (queueRef.current.length) void flush()
  }, [])

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) return
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null
      void flush()
    }, 2000)
  }, [flush])

  const track = useCallback((payload: TrackPayload) => {
    if (typeof window === 'undefined') return
    const path = payload.pagePath || window.location.pathname + window.location.search
    if (payload.productId && !viewedProductsRef.current.includes(payload.productId)) {
      viewedProductsRef.current = [...viewedProductsRef.current.slice(-19), payload.productId]
    }
    queueRef.current.push({
      eventType: payload.eventType,
      pagePath: path.slice(0, 500),
      pageType: payload.pageType || pageTypeRef.current,
      productId: payload.productId ?? null,
      categoryId: payload.categoryId ?? null,
      searchQuery: payload.searchQuery ?? null,
      activeMs: Math.max(0, Math.min(30 * 60 * 1000, Math.trunc(payload.activeMs || 0))),
      scrollDepth: payload.scrollDepth == null ? null : Math.max(0, Math.min(100, Math.trunc(payload.scrollDepth))),
      metadata: payload.metadata || null,
    })
    if (queueRef.current.length >= 10) void flush()
    else scheduleFlush()
  }, [flush, scheduleFlush])

  // Events queued before the session id existed are sent once it does.
  useEffect(() => {
    if (sessionId && queueRef.current.length) scheduleFlush()
  }, [scheduleFlush, sessionId])

  const commitActive = useCallback(() => {
    if (!activeStartRef.current) activeStartRef.current = Date.now()
    if (visibleRef.current) {
      activeAccumRef.current += Math.max(0, Date.now() - activeStartRef.current)
      activeStartRef.current = Date.now()
    }
  }, [])

  const getSnapshot = useCallback(() => {
    commitActive()
    return { activeMs: activeAccumRef.current, maxScroll: maxScrollRef.current, viewedProductIds: [...viewedProductsRef.current] }
  }, [commitActive])

  // Child pages call this from their effects, which run before ours on navigation,
  // so the context is stamped with the URL it belongs to rather than reset blindly.
  const setPageContext = useCallback((info: PageContextInfo) => {
    const current = `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`
    const base = pageContextRef.current.routeKey === current ? pageContextRef.current : { routeKey: current }
    pageContextRef.current = { ...base, ...info, routeKey: current }
    window.dispatchEvent(new CustomEvent('engagement:context', { detail: info }))
  }, [])

  const getPageContext = useCallback(() => pageContextRef.current, [])

  // New route: close out the previous page, then reset per-page counters.
  useEffect(() => {
    const previous = lastRouteRef.current
    if (previous?.routeKey === routeKey) return
    if (previous && activeStartRef.current) {
      commitActive()
      if (activeAccumRef.current > 0) {
        track({ eventType: 'active_dwell', activeMs: activeAccumRef.current, scrollDepth: maxScrollRef.current, pagePath: previous.routeKey.replace(/\?$/, ''), pageType: previous.pageType })
      }
    }
    lastRouteRef.current = { routeKey, pageType }
    if (pageContextRef.current.routeKey !== routeKey) pageContextRef.current = { routeKey }
    activeAccumRef.current = 0
    activeStartRef.current = Date.now()
    visibleRef.current = typeof document === 'undefined' ? true : !document.hidden
    maxScrollRef.current = 0
    track({ eventType: 'page_view', pagePath: routeKey.replace(/\?$/, ''), pageType })
  }, [routeKey, pageType, track, commitActive])

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - window.innerHeight
      // A page that cannot scroll has been "fully seen".
      const pct = scrollable <= 8 ? 100 : Math.round((window.scrollY / scrollable) * 100)
      if (pct > maxScrollRef.current) maxScrollRef.current = Math.min(100, pct)
    }
    const onVisibility = () => {
      if (document.hidden) {
        commitActive()
        visibleRef.current = false
        void flush()
      } else {
        visibleRef.current = true
        activeStartRef.current = Date.now()
      }
    }
    const onPageHide = () => {
      commitActive()
      track({ eventType: 'active_dwell', activeMs: activeAccumRef.current, scrollDepth: maxScrollRef.current })
      void flush()
    }
    const interval = setInterval(() => { if (!document.hidden) commitActive() }, 15000)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      clearInterval(interval)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [commitActive, flush, track])

  useEffect(() => () => {
    if (flushTimer.current) clearTimeout(flushTimer.current)
  }, [])

  const value = useMemo(
    () => ({ sessionId, pageType, routeKey, track, getSnapshot, setPageContext, getPageContext }),
    [getPageContext, getSnapshot, pageType, routeKey, sessionId, setPageContext, track],
  )
  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>
}

export function useEngagement() {
  return useContext(EngagementContext)
}
