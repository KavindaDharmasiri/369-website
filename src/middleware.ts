import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('authToken')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '')

  // Protect admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/signin', request.url))
    }
    
    try {
      // Decode JWT to check user type
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = JSON.parse(Buffer.from(base64, 'base64').toString())
      
      if (jsonPayload.userType !== 'admin') {
        return NextResponse.redirect(new URL('/customer/shop', request.url))
      }
    } catch (error) {
      return NextResponse.redirect(new URL('/signin', request.url))
    }
  }

  // Protect customer routes
  if (request.nextUrl.pathname.startsWith('/customer')) {
    if (!token) {
      return NextResponse.redirect(new URL('/signin', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/customer/:path*']
}
