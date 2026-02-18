'use client'
import { LoadingProvider } from '@/lib/LoadingContext'
import LoadingScreen from '@/components/LoadingScreen'
import { useLoading } from '@/lib/LoadingContext'
import { useFetchInterceptor } from '@/lib/useFetchInterceptor'

function LoadingScreenWrapper() {
  const { isLoading } = useLoading()
  useFetchInterceptor()
  return <LoadingScreen isLoading={isLoading} />
}

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LoadingProvider>
      <LoadingScreenWrapper />
      {children}
    </LoadingProvider>
  )
}
