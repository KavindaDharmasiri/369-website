import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET

function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function base64UrlEncode(input: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < input.length; i++) {
    binary += String.fromCharCode(input[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function verifyToken(token: string): Promise<any | null> {
  if (!JWT_SECRET) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, payload, signature] = parts

    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )

    const expected = await crypto.subtle.sign(
      'HMAC',
      key,
      enc.encode(`${header}.${payload}`)
    )

    if (base64UrlEncode(new Uint8Array(expected)) !== signature) {
      return null
    }

    const jsonPayload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)))
    if (jsonPayload.exp && Date.now() / 1000 > jsonPayload.exp) {
      return null
    }

    return jsonPayload
  } catch (error) {
    return null
  }
}

function isPublicCustomerPath(pathname: string): boolean {
  return pathname.startsWith('/customer/shop') ||
    pathname.startsWith('/customer/category') ||
    pathname.startsWith('/customer/product') ||
    pathname.startsWith('/customer/women') ||
    pathname.startsWith('/customer/men')
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('authToken')?.value ||
                request.headers.get('authorization')?.replace('Bearer ', '')

  const isAdminPath = request.nextUrl.pathname.startsWith('/admin')
  const isProtectedCustomerPath = request.nextUrl.pathname.startsWith('/customer') &&
    !isPublicCustomerPath(request.nextUrl.pathname)

  if (!token) {
    if (isAdminPath || isProtectedCustomerPath) {
      return NextResponse.redirect(new URL('/signin', request.url))
    }
    return NextResponse.next()
  }

  const payload = await verifyToken(token)

  if (isAdminPath) {
    if (!payload) {
      return NextResponse.redirect(new URL('/signin', request.url))
    }
    if (payload.userType !== 'admin') {
      return NextResponse.redirect(new URL('/customer/shop', request.url))
    }
  }

  if (isProtectedCustomerPath && !payload) {
    return NextResponse.redirect(new URL('/signin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/customer/:path*']
}
