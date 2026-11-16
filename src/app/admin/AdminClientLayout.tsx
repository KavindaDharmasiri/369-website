'use client'
import { Fragment, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { removeAuthToken } from '@/lib/clientAuth'
import { useClientAuthUser } from '@/lib/useClientAuthUser'

export default function AdminClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const authUser = useClientAuthUser()

  useEffect(() => {
    if (authUser === undefined) return
    if (!authUser || authUser.userType !== 'admin') {
      router.replace('/signin')
      return
    }
    const currentTime = Math.floor(Date.now() / 1000)
    if (authUser.exp && authUser.exp < currentTime) {
      removeAuthToken()
      router.replace('/signin')
      return
    }
  }, [router, authUser])

  if (!authUser || authUser.userType !== 'admin') return null

  return <Fragment key={authUser.userId}>{children}</Fragment>
}
