import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'

function isPath(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`)
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isAdminPath = isPath(pathname, '/admin')
  const isPublicCustomerPath = ['/customer/shop', '/customer/category', '/customer/product', '/customer/women', '/customer/men']
    .some(base => isPath(pathname, base))
  if (!isAdminPath && isPublicCustomerPath) return NextResponse.next()
  const token = request.cookies.get('authToken')?.value || request.headers.get('authorization')?.replace('Bearer ', '')
  const user = token ? await loadActiveUser(verifyToken(token)) : null
  if (!user) return NextResponse.redirect(new URL('/signin', request.url))
  if (isAdminPath && user.userType !== 'admin') return NextResponse.redirect(new URL('/customer/shop', request.url))
  return NextResponse.next()
}

export const config = { matcher: ['/admin/:path*', '/customer/:path*'] }
