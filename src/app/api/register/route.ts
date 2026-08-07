import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'
import { encrypt, decrypt } from '@/lib/encryption'
import { generateToken } from '@/lib/auth'
import { createNotification } from '@/lib/notify'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const decryptedPayload = JSON.parse(decrypt(body.data))
    const { email, password, firstName, lastName, phone } = decryptedPayload

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      const encrypted = encrypt(JSON.stringify({ error: 'Email already exists' }))
      return NextResponse.json({ data: encrypted }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null
      }
    })

    createNotification({
      type: 'NEW_USER',
      title: 'New Customer Registered',
      message: `${firstName || email} created an account.`,
      entityId: String(user.id),
    }).catch(() => null)

    const token = generateToken({ userId: user.id, email: user.email, userType: user.userType, createdAt: user.createdAt })

    const encrypted = encrypt(JSON.stringify({
      message: 'User created successfully',
      userId: user.id,
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
    console.error('Registration error:', error)
    const encrypted = encrypt(JSON.stringify({ error: 'Registration failed' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}
