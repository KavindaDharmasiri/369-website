import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET() {
  const serverKey = process.env.ENCRYPTION_KEY
  const publicKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY

  let dbConnected = false
  let dbError = ''
  try {
    await prisma.$queryRaw`SELECT 1`
    dbConnected = true
  } catch (e: any) {
    dbError = String(e?.message || e).slice(0, 300)
  }

  return NextResponse.json({
    serverKeySet: !!serverKey,
    publicKeySet: !!publicKey,
    keysMatch: !!serverKey && !!publicKey && serverKey === publicKey,
    jwtSet: !!process.env.JWT_SECRET,
    dbConnected,
    dbError
  })
}
