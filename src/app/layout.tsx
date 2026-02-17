import type { Metadata } from 'next'
import './globals.css'
import ClientWrapper from '@/components/ClientWrapper'

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
      <body>
        <ClientWrapper>{children}</ClientWrapper>
      </body>
    </html>
  )
}
