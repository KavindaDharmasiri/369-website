import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET() {
  try {
    await prisma.$connect()
    return NextResponse.json({ message: 'Database connected successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
  }
}
