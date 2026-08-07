import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './auth'

export function requireAuth(handler: Function) {
  return async (request: NextRequest, context?: any) => {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    return handler(request, user, context)
  }
}

export function requireAdmin(handler: Function) {
  return async (request: NextRequest, context?: any) => {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || user.userType !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    return handler(request, user, context)
  }
}
