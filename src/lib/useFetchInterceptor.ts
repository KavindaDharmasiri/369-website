'use client'
import { useEffect } from 'react'
import { useLoading } from './LoadingContext'

export function useFetchInterceptor() {
  const { showLoading, hideLoading } = useLoading()

  useEffect(() => {
    const originalFetch = window.fetch
    let activeRequests = 0

    window.fetch = async (...args) => {
      activeRequests++
      if (activeRequests === 1) {
        showLoading()
      }

      try {
        const response = await originalFetch(...args)
        return response
      } finally {
        activeRequests--
        if (activeRequests === 0) {
          hideLoading()
        }
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [showLoading, hideLoading])
}
