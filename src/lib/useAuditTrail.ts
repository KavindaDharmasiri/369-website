import { useCallback } from 'react'

export function useAuditTrail() {
  const logActivity = useCallback(async (
    action: string,
    entityType: string,
    entityId?: string | number,
    metadata?: any
  ) => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return // Only log if user is logged in

      await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          entityType,
          entityId: entityId?.toString(),
          metadata
        })
      })
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.error('Audit log failed:', error)
    }
  }, [])

  return { logActivity }
}
