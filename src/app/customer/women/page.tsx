'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Women() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/customer/category?type=women')
  }, [router])

  return null
}
