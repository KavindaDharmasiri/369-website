import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'
import { encrypt, decrypt } from '@/lib/encryption'
import { generateToken } from '@/lib/auth'
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rateLimit'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const decryptedPayload = JSON.parse(decrypt(body.data))
    const { email, password } = decryptedPayload
    const ip = getClientIp(request)
    const emailKey = typeof email === 'string' ? email.toLowerCase().trim() : 'unknown'
    const rl = checkRateLimit(`login:${ip}:${emailKey}`, 10, 15 * 60 * 1000)
    if (!rl.allowed) {
      const encrypted = encrypt(JSON.stringify({ error: 'Too many login attempts. Please try again later.' }))
      return NextResponse.json({ data: encrypted }, { status: 429, headers: rateLimitHeaders(rl) })
    }

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      const encrypted = encrypt(JSON.stringify({ error: 'Invalid credentials' }))
      return NextResponse.json({ data: encrypted }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }

    if (!user.isActive) {
      const encrypted = encrypt(JSON.stringify({ error: 'Account is inactive' }))
      return NextResponse.json({ data: encrypted }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      const encrypted = encrypt(JSON.stringify({ error: 'Invalid credentials' }))
      return NextResponse.json({ data: encrypted }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const token = generateToken({ userId: user.id, email: user.email, userType: user.userType, createdAt: user.createdAt, sessionVersion: (user as any).sessionVersion ?? 0 })

    const encrypted = encrypt(JSON.stringify({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        createdAt: user.createdAt
      }
    }))

    return NextResponse.json({ data: encrypted }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    logServerError('Login error', error)
    const encrypted = encrypt(JSON.stringify({ error: 'Login failed' }))
    return NextResponse.json({ data: encrypted }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
import { logServerError } from '@/lib/serverLog'
