'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuditTrail } from './useAuditTrail'

export function useActivityTracker() {
  const pathname = usePathname()
  const { logActivity } = useAuditTrail()
  const pageStartTime = useRef<number>(Date.now())
  const scrollDepth = useRef<number>(0)
  const lastScrollLog = useRef<number>(0)

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (!token) return

    // Log page view
    pageStartTime.current = Date.now()
    logActivity('PAGE_VIEW', 'page', pathname, { url: window.location.href })

    // Track scroll depth
    const handleScroll = () => {
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const scrollTop = window.scrollY
      const currentDepth = Math.round((scrollTop / (documentHeight - windowHeight)) * 100)

      if (currentDepth > scrollDepth.current && currentDepth % 25 === 0) {
        scrollDepth.current = currentDepth
        const now = Date.now()
        if (now - lastScrollLog.current > 2000) {
          logActivity('SCROLL', 'page', pathname, { depth: currentDepth })
          lastScrollLog.current = now
        }
      }
    }

    // Track time spent on page
    const logTimeSpent = () => {
      const timeSpent = Math.round((Date.now() - pageStartTime.current) / 1000)
      if (timeSpent > 5) {
        logActivity('TIME_SPENT', 'page', pathname, { seconds: timeSpent })
      }
    }

    window.addEventListener('scroll', handleScroll)
    const timeInterval = setInterval(logTimeSpent, 30000) // Log every 30 seconds

    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearInterval(timeInterval)
      logTimeSpent() // Log final time on unmount
    }
  }, [pathname, logActivity])
}
