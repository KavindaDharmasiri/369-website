'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AccountPage() {
  const router = useRouter()

  useEffect(() => {
    router.push('/customer/account/orders')
  }, [router])

  return <div>Redirecting...</div>
}