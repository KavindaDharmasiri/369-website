import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './auth'
import prisma from './db'

const privateNoStore = { 'Cache-Control': 'private, no-store' }

export async function loadActiveUser(user: any) {
  if (!user || !Number.isInteger(user.userId) || user.userId < 1) return null
  try {
    let dbUser: any
    try {
      dbUser = await (prisma.user.findUnique as any)({
        where: { id: user.userId },
        select: { id: true, email: true, userType: true, isActive: true, createdAt: true, sessionVersion: true },
      })
    } catch (error: any) {
      if (error?.code === 'P2022' || /sessionVersion|session_version|Unknown arg/i.test(error?.message || '')) {
        dbUser = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { id: true, email: true, userType: true, isActive: true, createdAt: true },
        })
      } else {
        throw error
      }
    }
    if (!dbUser || !dbUser.isActive) return null
    if (Object.prototype.hasOwnProperty.call(dbUser, 'sessionVersion')) {
      // Legacy tokens represent version zero, not an exemption from revocation.
      const tokenVersion = user.sessionVersion ?? 0
      if (!Number.isInteger(tokenVersion) || tokenVersion < 0 || tokenVersion !== dbUser.sessionVersion) return null
    }
    return {
      ...user,
      userId: dbUser.id,
      email: dbUser.email,
      userType: dbUser.userType,
      createdAt: dbUser.createdAt,
      sessionVersion: dbUser.sessionVersion ?? 0,
    }
  } catch {
    return null
  }
}

export function requireAuth(handler: Function) {
  return async (request: NextRequest, context?: any) => {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateNoStore })
    }

    const decoded = verifyToken(token)
    const user = await loadActiveUser(decoded)
    if (!user) {
      return NextResponse.json({ error: 'Invalid or inactive session' }, { status: 401, headers: privateNoStore })
    }

    return handler(request, user, context)
  }
}

export function requireAdmin(handler: Function) {
  return async (request: NextRequest, context?: any) => {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateNoStore })
    }

    const decoded = verifyToken(token)
    const user = await loadActiveUser(decoded)
    if (!user) {
      return NextResponse.json({ error: 'Invalid or inactive session' }, { status: 401, headers: privateNoStore })
    }
    if (user.userType !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403, headers: privateNoStore })
    }

    return handler(request, user, context)
  }
}
