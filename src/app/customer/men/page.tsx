'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Men() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/customer/category?type=men')
  }, [router])

  return null
}
