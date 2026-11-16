'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEngagement } from '@/lib/engagement/tracker'
import { ASSISTANT_HIDDEN_PAGES } from '@/lib/engagement/pageType'
import { getProductVisitCount } from '@/lib/engagement/session'
import { readGuestCart } from '@/lib/guestCart'
import type { SuggestionResult } from '@/lib/recommendations/types'
import { getPageTips, runTipAction, TIP_SHARE, type PageTip } from '@/lib/engagement/pageTips'
import styles from './ShoppingAssistant.module.css'

const FALLBACK_IMG = 'https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png'
/** First suggestion on a page. */
const FIRST_ASK_MS = 30000
/** How often the page checks whether fresh ideas should be offered. */
const LOOP_MS = 1000 // TESTING (normal: 6000)
/** After closing, wait this long (active, visible time) before offering new ideas on the same page. */
const REOPEN_AFTER_MS = 30000
/** Auto-opened suggestions per page visit (the AI button is always available on top of this). */
const MAX_AUTO_PER_VISIT = 20 // TESTING (normal: 3)
const CART_INACTIVE_ASK_MS = 46000
const MIN_ASK_GAP_MS = 2500
const LEAVE_MS = 260
const SNOOZE_MS = 30 * 60 * 1000
const SNOOZE_KEY = 'assistantSnoozedUntil'
const SHOWN_KEY = 'assistantShownProducts'

type View = 'open' | 'orb' | 'none'
/** A card is either product suggestions from the server or an action tip built from the page. */
type Shown = { routeKey: string; data: SuggestionResult | null; tip: PageTip | null; nonce: number }
type AskOptions = { force?: boolean; userRequested?: boolean; refresh?: boolean; preferTip?: boolean; preferProducts?: boolean }
/** Don't pop up while the shopper is typing in a form. */
const TYPING_QUIET_MS = 8000

const PAGE_LABELS: Record<string, string> = {
  home: 'Home', shop: 'Shop', search: 'Search', category: 'This collection', product: 'This product',
  cart: 'Your bag', wishlist: 'Your wishlist', account: 'Your account', other: 'Suggestions',
}

function isEditable(el: Element | null) {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') { const t = (el as HTMLInputElement).type; return !['checkbox', 'radio', 'button', 'submit'].includes(t) && !(el as HTMLInputElement).readOnly }
  return (el as HTMLElement).isContentEditable
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function authToken(): string | null {
  try { return localStorage.getItem('authToken') } catch { return null }
}
function readSnooze(): number {
  try { return Number(sessionStorage.getItem(SNOOZE_KEY)) || 0 } catch { return 0 }
}
function readShownProducts(): number[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(SHOWN_KEY) || '[]')
    return Array.isArray(v) ? v.filter((n: unknown) => Number.isInteger(n)) : []
  } catch { return [] }
}
function rememberShownProducts(ids: number[]) {
  try {
    const next = [...readShownProducts().filter(id => !ids.includes(id)), ...ids].slice(-40)
    sessionStorage.setItem(SHOWN_KEY, JSON.stringify(next))
  } catch {}
}
function guestCartProductIds(): number[] {
  try {
    return readGuestCart(localStorage)
      .map((item: any) => Number(item?.productId ?? item?.product_id ?? item?.id))
      .filter(id => Number.isInteger(id) && id > 0)
  } catch { return [] }
}
function categoryRefFor(pathname: string, sp: URLSearchParams): string | null {
  if (pathname.startsWith('/customer/men')) return 'men'
  if (pathname.startsWith('/customer/women')) return 'women'
  return sp.get('type')
}
function formatLkr(v: unknown) {
  return `LKR ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** True while something else owns the screen: bag drawer, try-on, alert, loading screen. */
function screenIsBusy(): boolean {
  if (typeof document === 'undefined') return false
  if (document.querySelector('.swal2-container, [aria-modal="true"]')) return true
  const overlays = document.querySelectorAll<HTMLElement>('[class*="overlay"], [class*="Overlay"], [class*="modal"], [class*="Modal"]')
  for (const el of Array.from(overlays)) {
    if (el.closest('[data-shopping-assistant]')) continue
    const r = el.getBoundingClientRect()
    if (r.width >= window.innerWidth * 0.6 && r.height >= window.innerHeight * 0.6) {
      const cs = getComputedStyle(el)
      if (cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05) return true
    }
  }
  return false
}

function useScreenBusy() {
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let frame = 0
    const check = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setBusy(screenIsBusy()))
    }
    const mo = new MutationObserver(check)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-modal'] })
    check()
    return () => { mo.disconnect(); cancelAnimationFrame(frame) }
  }, [])
  return busy
}

/** Reveals text a few characters at a time, like an assistant typing. */
function useTypewriter(text: string, key: number) {
  const [count, setCount] = useState(0)
  const [prevKey, setPrevKey] = useState(key)
  if (prevKey !== key) { setPrevKey(key); setCount(0) }
  const reduced = typeof window !== 'undefined' && prefersReducedMotion()
  useEffect(() => {
    if (!text || reduced) return
    const id = setInterval(() => {
      setCount(c => {
        if (c >= text.length) { clearInterval(id); return c }
        return Math.min(text.length, c + 2)
      })
    }, 16)
    return () => clearInterval(id)
  }, [text, key, reduced])
  if (reduced) return { shown: text, done: true }
  return { shown: text.slice(0, count), done: count >= text.length }
}

// ---------------------------------------------------------------------------
// Icons (inline SVG so they always render)
// ---------------------------------------------------------------------------
function SparkleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: 'block' }}>
      <path className={styles.sparkMain} d="M12 2.5l1.9 5.6a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9L12 2.5z" fill="#ffffff" />
      <path className={styles.sparkSmall} d="M19 2v4M17 4h4" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
      <circle className={styles.sparkDot} cx="4.5" cy="19.5" r="1.3" fill="#ffffff" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: 'block' }}>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2.2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
const TIP_ICON_PATHS: Record<string, string> = {
  form: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  payment: 'M3 6h18v12H3zM3 10h18M7 15h4',
  order: 'M6 7h12l-1.5 12h-9zM9 7a3 3 0 0 1 6 0',
  coupon: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM10 7v10',
  size: 'M4 8h16v8H4zM8 8v3M12 8v4M16 8v3',
  bag: 'M6 7h12l-1.5 12h-9zM9 7a3 3 0 0 1 6 0',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  tryon: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z',
  reviews: 'M12 3l2.6 5.6 6 .7-4.5 4 1.3 6L12 16.4 6.6 19.3l1.3-6-4.5-4 6-.7z',
  filter: 'M4 6h16M7 12h10M10 18h4',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4',
  orders: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10',
  address: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
}
function TipIcon({ name }: { name: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: 'block' }}>
      <path d={TIP_ICON_PATHS[name] || TIP_ICON_PATHS.tryon} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ShoppingAssistant() {
  const engagement = useEngagement()
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const search = searchParams?.toString() || ''
  const routeKey = `${pathname}?${search}`
  const pageType = engagement?.pageType || 'other'
  const hiddenPage = ASSISTANT_HIDDEN_PAGES.includes(pageType)
  const busy = useScreenBusy()

  const [shown, setShown] = useState<Shown | null>(null)
  const [view, setView] = useState<View>('none')
  const [leaving, setLeaving] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [hasEverShown, setHasEverShown] = useState(false)
  const [snoozed, setSnoozed] = useState(false)

  const lastAskRef = useRef(0)
  const inFlightRef = useRef(false)
  const routeKeyRef = useRef(routeKey)
  const visitRef = useRef(0)
  const viewRef = useRef<View>('none')
  const autoOpensRef = useRef(0)
  const closedAtRef = useRef(0)
  const visitHadSuggestionRef = useRef(false)
  const unavailableRef = useRef<{ routeKey: string; value: boolean }>({ routeKey: '', value: false })
  const nonceRef = useRef(0)
  const shownTipsRef = useRef<Set<string>>(new Set())
  const lastTypingRef = useRef(0)
  const visitStartRef = useRef(0)

  const current = shown && shown.routeKey === routeKey ? shown : null
  const suggestion = current?.data || null
  const tip = current?.tip || null
  const panelOpen = view === 'open' && !!current

  useEffect(() => { viewRef.current = panelOpen ? 'open' : view === 'none' ? 'none' : 'orb' }, [panelOpen, view])

  // New page visit: reset the per-visit counters.
  useEffect(() => {
    routeKeyRef.current = routeKey
    visitRef.current += 1
    autoOpensRef.current = 0
    closedAtRef.current = 0
    visitHadSuggestionRef.current = false
    unavailableRef.current = { routeKey, value: false }
    shownTipsRef.current = new Set()
    visitStartRef.current = Date.now()
  }, [routeKey])

  // Remember when the shopper last typed, so we never interrupt form filling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (isEditable(e.target as Element)) lastTypingRef.current = Date.now() }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const ask = useCallback(async (reason: string, opts: AskOptions = {}) => {
    if (!engagement?.sessionId || hiddenPage) return false
    const now = Date.now()
    if (now < readSnooze()) return false
    if (!opts.userRequested) {
      if (document.hidden || screenIsBusy()) return false
      // Timers never replace a card the shopper is reading.
      if (viewRef.current === 'open' && !opts.force) return false
      if (now - lastAskRef.current < MIN_ASK_GAP_MS) return false
      if (isEditable(document.activeElement) || now - lastTypingRef.current < TYPING_QUIET_MS) return false
    }
    if (inFlightRef.current) return false

    // Action tips from the page itself (fill the form, pick a size, place the order...).
    const requestRouteForTip = routeKeyRef.current
    const sp0 = new URLSearchParams(search)
    const tips = getPageTips({
      pageType, pathname, searchQuery: sp0.get('search') || sp0.get('q'),
      cartCount: authToken() ? 0 : guestCartProductIds().length, isLoggedIn: !!authToken(),
    })
    const unseen = tips.filter(t => !shownTipsRef.current.has(t.key))
    const share = TIP_SHARE[pageType] ?? 0
    const wantTip = !opts.preferProducts && tips.length > 0 &&
      (opts.preferTip || share >= 1 || (unseen.length > 0 && Math.random() < share))
    const showTip = (t: PageTip) => {
      shownTipsRef.current.add(t.key)
      visitHadSuggestionRef.current = true
      if (!opts.userRequested) autoOpensRef.current += 1
      nonceRef.current += 1
      lastAskRef.current = Date.now()
      setShown({ routeKey: requestRouteForTip, data: null, tip: t, nonce: nonceRef.current })
      setLeaving(false)
      setView('open')
      setHasEverShown(true)
      engagement.track({ eventType: 'assistant_tip', metadata: { key: t.key } })
      return true
    }
    if (wantTip) {
      // Checkout is a sequence: always show the next step. Elsewhere, rotate through
      // tips the shopper hasn't seen on this visit, most useful first.
      const isCheckoutFlow = tips[0].key.startsWith('checkout_')
      const pick = isCheckoutFlow ? tips[0] : unseen[0] || (opts.userRequested ? tips[0] : null)
      if (pick) return showTip(pick)
    }
    lastAskRef.current = now
    inFlightRef.current = true
    if (opts.userRequested) setThinking(true)

    const requestRoute = routeKeyRef.current
    const requestVisit = visitRef.current
    try {
      const sp = new URLSearchParams(search)
      const snap = engagement.getSnapshot()
      const pageCtx = engagement.getPageContext()
      const ctxForRoute: any = pageCtx.routeKey === requestRoute ? pageCtx : {}
      const token = authToken()
      const guestCart = token ? [] : guestCartProductIds()
      const productId = pageType === 'product' ? ctxForRoute.productId ?? null : null

      const res = await fetch('/api/recommendations/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          sessionId: engagement.sessionId,
          pageType,
          pagePath: pathname + (search ? `?${search}` : ''),
          productId,
          productRef: pageType === 'product' ? sp.get('id') : null,
          categoryId: ctxForRoute.categoryId ?? null,
          categoryRef: pageType === 'category' ? categoryRefFor(pathname, sp) : null,
          searchQuery: sp.get('search') || sp.get('q') || null,
          cartCount: guestCart.length,
          cartProductIds: guestCart,
          viewedProductIds: snap.viewedProductIds,
          recentProductIds: snap.viewedProductIds,
          productViewCount: getProductVisitCount(productId),
          excludeProductIds: readShownProducts(),
          activeMs: snap.activeMs,
          scrollDepth: snap.maxScroll,
          unavailableSelection: unavailableRef.current.routeKey === requestRoute && unavailableRef.current.value,
          refresh: opts.refresh || visitHadSuggestionRef.current,
          userRequested: !!opts.userRequested,
          reason,
        }),
      })
      const json = await res.json().catch(() => null)
      const data: SuggestionResult | undefined = json?.data
      // Ignore answers for a page the shopper has already left.
      if (routeKeyRef.current !== requestRoute || visitRef.current !== requestVisit) return false
      if (!data?.enabled) {
        // No product idea right now: an unseen page tip is still useful.
        const fallback = tips.find(t => !shownTipsRef.current.has(t.key))
        return fallback ? showTip(fallback) : false
      }
      rememberShownProducts((data.products || []).slice(0, 4).map(p => p.id))
      visitHadSuggestionRef.current = true
      if (!opts.userRequested) autoOpensRef.current += 1
      nonceRef.current += 1
      setShown({ routeKey: requestRoute, data, tip: null, nonce: nonceRef.current })
      setLeaving(false)
      setView('open')
      setHasEverShown(true)
      return true
    } catch {
      return false // suggestions are optional; never break the page
    } finally {
      inFlightRef.current = false
      if (opts.userRequested) setThinking(false)
    }
  }, [engagement, hiddenPage, pageType, pathname, search])

  // Per page visit: first ask after a short dwell, then keep offering fresh ideas
  // (after a close) without needing a page refresh.
  useEffect(() => {
    if (hiddenPage || !engagement?.sessionId) return
    const first = setTimeout(() => { void ask('dwell') }, FIRST_ASK_MS)
    const loop = setInterval(() => {
      if (viewRef.current === 'open') return
      if (autoOpensRef.current >= MAX_AUTO_PER_VISIT) return
      const closedAt = closedAtRef.current
      if (visitHadSuggestionRef.current) {
        // Something was already shown on this visit: wait a while after it was closed.
        if (!closedAt || Date.now() - closedAt < REOPEN_AFTER_MS) return
        void ask('reoffer', { refresh: true })
      } else if (Date.now() - visitStartRef.current >= FIRST_ASK_MS) {
        void ask('dwell_loop') // nothing yet on this page (e.g. needed more dwell time)
      }
    }, LOOP_MS)
    const timers: ReturnType<typeof setTimeout>[] = [first]
    if (pageType === 'cart') timers.push(setTimeout(() => { void ask('cart_inactive', { force: true }) }, CART_INACTIVE_ASK_MS))
    return () => { timers.forEach(clearTimeout); clearInterval(loop) }
  }, [ask, hiddenPage, pageType, routeKey, engagement?.sessionId])

  // Behavioural triggers from pages (repeat view, unavailable size, bag changes).
  useEffect(() => {
    const onTrigger = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      if (detail.type === 'unavailable') unavailableRef.current = { routeKey: routeKeyRef.current, value: true }
      if (detail.force || ['repeat_view', 'compare', 'cart_inactive', 'unavailable'].includes(detail.type)) {
        void ask(detail.type || 'event', { force: true })
      }
    }
    const onCart = () => { if (pageType === 'cart') void ask('cart_updated') }
    window.addEventListener('engagement:trigger', onTrigger)
    window.addEventListener('cartUpdated', onCart)
    return () => {
      window.removeEventListener('engagement:trigger', onTrigger)
      window.removeEventListener('cartUpdated', onCart)
    }
  }, [ask, pageType])

  const sendInteraction = (status: 'clicked' | 'dismissed' | 'snoozed', snoozeMinutes?: number) => {
    if (!engagement?.sessionId || !suggestion) return
    const token = authToken()
    void fetch('/api/recommendations/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ sessionId: engagement.sessionId, impressionToken: suggestion.impressionToken, status, snoozeMinutes }),
      keepalive: true,
    }).catch(() => {})
  }

  /** Animate the card out, then collapse to the floating AI button. */
  const collapse = () => {
    closedAtRef.current = Date.now()
    if (prefersReducedMotion()) { setView('orb'); return }
    setLeaving(true)
    setTimeout(() => { setLeaving(false); setView('orb') }, LEAVE_MS)
  }

  const onDismiss = () => { sendInteraction('dismissed'); collapse() }
  const onSnooze = () => {
    try { sessionStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)) } catch {}
    sendInteraction('snoozed', 30)
    setSnoozed(true)
    setLeaving(true)
    setTimeout(() => { setLeaving(false); setView('none') }, LEAVE_MS)
  }
  const onMoreIdeas = async () => {
    const ok = await ask('more_ideas', { userRequested: true, refresh: true })
    if (!ok && current) setView('open')
  }
  /** On a tip card: next unseen tip for this page, or product ideas once tips run out. */
  const onNextTip = async () => {
    const sp0 = new URLSearchParams(search)
    const remaining = getPageTips({ pageType, pathname, searchQuery: sp0.get('search') || sp0.get('q'), cartCount: 0, isLoggedIn: !!authToken() })
      .filter(t => !shownTipsRef.current.has(t.key))
    const ok = await ask('next_tip', remaining.length ? { userRequested: true, preferTip: true } : { userRequested: true, preferProducts: true, refresh: true })
    if (!ok && current) setView('open')
  }
  const onTipCta = () => {
    if (!tip) return
    engagement?.track({ eventType: 'assistant_tip_click', metadata: { key: tip.key } })
    runTipAction(tip, styles.pulseTarget)
    collapse()
  }
  const onOrb = async () => {
    try { sessionStorage.removeItem(SNOOZE_KEY) } catch {}
    setSnoozed(false)
    const ok = await ask('orb', { userRequested: true, refresh: !!current })
    if (!ok && current) setView('open')
  }
  const onHashCta = (href: string) => {
    const el = document.getElementById(href.slice(1))
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.add(styles.pulseTarget)
      setTimeout(() => el.classList.remove(styles.pulseTarget), 2400)
    }
    sendInteraction('clicked')
    collapse()
  }

  const nonce = shown?.nonce || 0
  const typed = useTypewriter(suggestion?.message || tip?.message || '', nonce)

  // While a tip is open, follow the page live: the checklist ticks off as fields are
  // filled, and the card moves on by itself (e.g. size chosen -> "add to bag").
  const tipKey = panelOpen && tip ? tip.key : null
  useEffect(() => {
    if (!tipKey) return
    const id = setInterval(() => {
      const sp0 = new URLSearchParams(search)
      const tips = getPageTips({ pageType, pathname, searchQuery: sp0.get('search') || sp0.get('q'), cartCount: 0, isLoggedIn: !!authToken() })
      const same = tips.find(t => t.key === tipKey)
      setShown(prev => {
        if (!prev || !prev.tip || prev.tip.key !== tipKey || prev.routeKey !== routeKeyRef.current) return prev
        // Checkout: when a step is completed, move straight on to the next one.
        const top = tips[0]
        if (top && prev.tip.key.startsWith('checkout_') && top.key !== prev.tip.key && top.priority > prev.tip.priority) {
          shownTipsRef.current.add(top.key)
          nonceRef.current += 1
          return { ...prev, tip: top, nonce: nonceRef.current }
        }
        if (same) {
          const changed = same.message !== prev.tip.message || JSON.stringify(same.steps) !== JSON.stringify(prev.tip.steps) || same.ctaLabel !== prev.tip.ctaLabel
          return changed ? { ...prev, tip: same } : prev
        }
        // This step is done: show what comes next (only if something useful remains).
        const next = tips[0]
        if (!next) return prev
        shownTipsRef.current.add(next.key)
        nonceRef.current += 1
        return { ...prev, tip: next, nonce: nonceRef.current }
      })
    }, 900)
    return () => clearInterval(id)
  }, [tipKey, pageType, pathname, search])

  if (hiddenPage) return null

  const showOrb = !panelOpen && !snoozed && (hasEverShown || view === 'orb') && !busy
  if (!panelOpen && !showOrb) return null

  if (!panelOpen) {
    return (
      <button
        type="button"
        data-shopping-assistant
        className={`${styles.orb} ${thinking ? styles.orbThinking : ''}`}
        onClick={onOrb}
        aria-label="Ask the AI stylist for ideas for this page"
        title="AI Stylist: ideas for this page"
      >
        <span className={styles.orbRing} aria-hidden="true" />
        <SparkleIcon size={22} />
      </button>
    )
  }

  if (tip) {
    const accentTip = ['home', 'shop', 'search', 'category', 'product', 'cart', 'wishlist', 'account'].includes(pageType) ? pageType : 'other'
    const isCheckoutTip = tip.key.startsWith('checkout_')
    return (
      <aside
        key={nonce}
        data-shopping-assistant
        className={`${styles.panel} ${styles[`accent_${accentTip}`] || ''} ${leaving ? styles.leaving : ''} ${busy ? styles.suppressed : ''}`}
        aria-live="polite"
        aria-label={`AI stylist tip: ${tip.title}`}
        data-page-type={pageType}
      >
        <span className={styles.aurora} aria-hidden="true" />
        <div className={styles.header}>
          <div className={styles.aiIcon} aria-hidden="true"><SparkleIcon /></div>
          <div className={styles.headText}>
            <div className={styles.kickerRow}>
              <span className={styles.aiLabel}>AI Stylist</span>
              <span className={styles.contextBadge}><span className={styles.dot} aria-hidden="true" />{isCheckoutTip ? 'Checkout' : PAGE_LABELS[pageType] || 'Tip'}</span>
            </div>
            <h3 className={styles.title}>{tip.title}</h3>
          </div>
          <button className={styles.iconBtn} aria-label="Close tip" onClick={collapse}><CloseIcon /></button>
        </div>

        <p className={styles.message} aria-label={tip.message}>
          <span aria-hidden="true">{typed.shown}</span>
          {!typed.done && <span className={styles.caret} aria-hidden="true" />}
        </p>

        {tip.steps ? (
          <ol className={styles.steps} aria-label="Checkout progress">
            {tip.steps.map((st, i) => (
              <li key={st.label} className={`${styles.step} ${styles[`step_${st.state}`] || ''}`} style={{ ['--i' as any]: i }}>
                <span className={styles.stepMark} aria-hidden="true">{st.state === 'done' ? <CheckIcon /> : i + 1}</span>
                <span className={styles.stepLabel}>{st.label}</span>
                {st.detail && <span className={styles.stepDetail}>{st.detail}</span>}
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.tipBadge} style={{ ['--i' as any]: 0 }}>
            <span className={styles.tipIcon} aria-hidden="true"><TipIcon name={tip.icon} /></span>
            <span>{tip.ctaLabel}</span>
          </div>
        )}

        <div className={styles.actions}>
          {tip.href ? (
            <Link href={tip.href} className={styles.primary} onClick={() => { engagement?.track({ eventType: 'assistant_tip_click', metadata: { key: tip.key } }); collapse() }}>{tip.ctaLabel}</Link>
          ) : (
            <button className={styles.primary} onClick={onTipCta}>{isCheckoutTip && <LockIcon />}{tip.ctaLabel}</button>
          )}
          {isCheckoutTip ? (
            <button className={styles.secondary} onClick={collapse}>Not now</button>
          ) : (
            <button className={styles.secondary} onClick={onNextTip} disabled={thinking}>
              <span className={`${styles.refreshIcon} ${thinking ? styles.spin : ''}`}><RefreshIcon /></span>
              Next idea
            </button>
          )}
        </div>
        <button className={styles.snoozeLink} onClick={onSnooze}>Pause suggestions for 30 min</button>
      </aside>
    )
  }

  const data = suggestion!
  const products = Array.isArray(data.products) ? data.products.slice(0, 4) : []
  const primaryHref = data.ctaHref || (products[0]?.id ? `/customer/product?id=${products[0].slug || products[0].id}` : '/customer/shop')
  const accent = data.context?.accent || 'other'
  const isCheckout = data.action === 'continue_checkout'

  return (
    <aside
      key={nonce}
      data-shopping-assistant
      className={`${styles.panel} ${styles[`accent_${accent}`] || ''} ${leaving ? styles.leaving : ''} ${busy ? styles.suppressed : ''}`}
      aria-live="polite"
      aria-label={`AI stylist suggestions for ${data.context?.label || 'this page'}`}
      data-page-type={data.context?.pageType || pageType}
    >
      <span className={styles.aurora} aria-hidden="true" />
      <div className={styles.header}>
        <div className={styles.aiIcon} aria-hidden="true">
          <SparkleIcon />
        </div>
        <div className={styles.headText}>
          <div className={styles.kickerRow}>
            <span className={styles.aiLabel}>AI Stylist</span>
            <span className={styles.contextBadge} title="Suggestions for the page you are on">
              <span className={styles.dot} aria-hidden="true" />
              {data.context?.label || 'Suggestions'}
            </span>
          </div>
          <h3 className={styles.title}>{data.title}</h3>
        </div>
        <button className={styles.iconBtn} aria-label="Close suggestion" onClick={onDismiss}><CloseIcon /></button>
      </div>

      <p className={styles.message} aria-label={data.message}>
        <span aria-hidden="true">{typed.shown}</span>
        {!typed.done && <span className={styles.caret} aria-hidden="true" />}
      </p>

      {thinking ? (
        <div className={styles.products} aria-busy="true">
          {[0, 1, 2].map(i => <div key={i} className={styles.skeleton} style={{ ['--i' as any]: i }} />)}
          <div className={styles.thinkingRow}><span className={styles.dots}><i /><i /><i /></span> Finding fresh ideas…</div>
        </div>
      ) : products.length > 0 && (
        <div className={styles.products}>
          {products.map((p, i) => (
            <Link
              key={p.id}
              href={`/customer/product?id=${p.slug || p.id}`}
              className={`${styles.product} ${p.reason === 'Something different' ? styles.discovery : ''}`}
              style={{ ['--i' as any]: i }}
              onClick={() => { sendInteraction('clicked'); collapse() }}
            >
              <span className={styles.thumb}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image || FALLBACK_IMG}
                  alt={p.name}
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget
                    // Try the store placeholder once; if that fails too, show the tinted tile only.
                    if (img.src !== FALLBACK_IMG) img.src = FALLBACK_IMG
                    else img.style.visibility = 'hidden'
                  }}
                />
              </span>
              <div className={styles.productInfo}>
                <div className={styles.productName}>{p.name}</div>
                <div className={styles.productPrice}>
                  {formatLkr(p.price)}
                  {p.originalPrice ? <s className={styles.originalPrice}>{formatLkr(p.originalPrice)}</s> : null}
                </div>
                {p.reason && <span className={styles.reason}>{p.reason}</span>}
              </div>
              <span className={styles.arrow} aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        {primaryHref.startsWith('#') ? (
          <button className={styles.primary} onClick={() => onHashCta(primaryHref)}>{isCheckout && <LockIcon />}{data.ctaLabel || 'Show me'}</button>
        ) : (
          <Link href={primaryHref} className={styles.primary} onClick={() => { sendInteraction('clicked'); collapse() }}>{isCheckout && <LockIcon />}{data.ctaLabel || 'Explore'}</Link>
        )}
        {isCheckout ? (
          <button className={styles.secondary} onClick={onDismiss}>Not now</button>
        ) : data.secondaryCtaHref ? (
          <Link href={data.secondaryCtaHref} className={styles.secondary} onClick={() => { sendInteraction('clicked'); collapse() }}>{data.secondaryCtaLabel || 'More'}</Link>
        ) : (
          <button className={styles.secondary} onClick={onMoreIdeas} disabled={thinking}>
            <span className={`${styles.refreshIcon} ${thinking ? styles.spin : ''}`}><RefreshIcon /></span>
            More ideas
          </button>
        )}
      </div>
      <button className={styles.snoozeLink} onClick={onSnooze}>Pause suggestions for 30 min</button>
    </aside>
  )
}
