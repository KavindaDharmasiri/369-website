import { NextResponse } from 'next/server'
import { encrypt } from '@/lib/encryption'

export async function POST(request: Request) {
  try {
    const { data } = await request.json()
    const encrypted = encrypt(data)
    return NextResponse.json({ encrypted })
  } catch (error) {
    return NextResponse.json({ error: 'Encryption failed' }, { status: 500 })
  }
}
