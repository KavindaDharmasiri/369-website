import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'
import { encrypt, decrypt } from '@/lib/encryption'
import { generateToken } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const decryptedPayload = JSON.parse(decrypt(body.data))
    const { email, password } = decryptedPayload

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      const encrypted = encrypt(JSON.stringify({ error: 'Invalid credentials' }))
      return NextResponse.json({ data: encrypted }, { status: 401 })
    }

    if (!user.isActive) {
      const encrypted = encrypt(JSON.stringify({ error: 'Account is inactive' }))
      return NextResponse.json({ data: encrypted }, { status: 403 })
    }

    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      const encrypted = encrypt(JSON.stringify({ error: 'Invalid credentials' }))
      return NextResponse.json({ data: encrypted }, { status: 401 })
    }

    const token = generateToken({ userId: user.id, email: user.email, userType: user.userType, createdAt: user.createdAt })

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

    return NextResponse.json({ data: encrypted })
  } catch (error) {
    console.error('Login error:', error)
    const encrypted = encrypt(JSON.stringify({ error: 'Login failed' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}
