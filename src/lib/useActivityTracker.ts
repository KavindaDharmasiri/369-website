'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuditTrail } from './useAuditTrail'

export function useActivityTracker() {
  const pathname = usePathname()
  const { logActivity } = useAuditTrail()
  const pageStartTime = useRef<number>(Date.now())

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (!token) return

    // Log page view once per page load
    pageStartTime.current = Date.now()
    logActivity('PAGE_VIEW', 'page', pathname, { url: window.location.href })

    // Log total time spent once when leaving the page
    const logTimeSpent = () => {
      const timeSpent = Math.round((Date.now() - pageStartTime.current) / 1000)
      if (timeSpent > 5) {
        logActivity('TIME_SPENT', 'page', pathname, { seconds: timeSpent })
      }
    }

    return () => {
      logTimeSpent()
    }
  }, [pathname, logActivity])
}
