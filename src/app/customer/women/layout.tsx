import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Women's collection",
  alternates: { canonical: '/customer/category?type=women' },
  robots: { index: true, follow: true },
}

export default function WomenLayout({ children }: { children: React.ReactNode }) {
  return children
}
