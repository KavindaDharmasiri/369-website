'use client'
import { Suspense } from 'react'
import { LoadingProvider } from '@/lib/LoadingContext'
import LoadingScreen from '@/components/LoadingScreen'
import { useLoading } from '@/lib/LoadingContext'
import { useActivityTracker } from '@/lib/useActivityTracker'
import { EngagementProvider } from '@/lib/engagement/tracker'
import ShoppingAssistant from '@/components/recommendations/ShoppingAssistant'

function LoadingScreenWrapper() {
  const { isLoading } = useLoading()
  useActivityTracker()
  return <LoadingScreen isLoading={isLoading} />
}

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LoadingProvider>
      <Suspense fallback={null}>
        <EngagementProvider>
          <LoadingScreenWrapper />
          {children}
          <ShoppingAssistant />
        </EngagementProvider>
      </Suspense>
    </LoadingProvider>
  )
}
