import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'
import { encrypt, decrypt } from '@/lib/encryption'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const decryptedPayload = JSON.parse(decrypt(body.data))
    const { email, password } = decryptedPayload

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
        password: hashedPassword
      }
    })

    const encrypted = encrypt(JSON.stringify({ message: 'User created successfully', userId: user.id }))
    return NextResponse.json({ data: encrypted })
  } catch (error) {
    console.error('Registration error:', error)
    const encrypted = encrypt(JSON.stringify({ error: 'Registration failed' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}
