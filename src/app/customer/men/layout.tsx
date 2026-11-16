import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Men's collection",
  alternates: { canonical: '/customer/category?type=men' },
  robots: { index: true, follow: true },
}

export default function MenLayout({ children }: { children: React.ReactNode }) {
  return children
}
