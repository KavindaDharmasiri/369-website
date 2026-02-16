import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '369 Website',
  description: 'Full-stack Next.js application with SSR',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
