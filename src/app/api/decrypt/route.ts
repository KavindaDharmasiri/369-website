import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/encryption'

export async function POST(request: Request) {
  try {
    const { encrypted } = await request.json()
    const decrypted = decrypt(encrypted)
    return NextResponse.json({ decrypted })
  } catch (error) {
    return NextResponse.json({ error: 'Decryption failed' }, { status: 500 })
  }
}
