import { NextRequest, NextResponse } from 'next/server'
import { decrypt, encrypt } from '@/lib/encryption'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { endpoint, method = 'GET', data } = JSON.parse(decrypt(body.data))
    
    const url = new URL(endpoint, req.url)
    const response = await fetch(url, {
      method,
      headers: req.headers,
      body: data ? JSON.stringify({ data: encrypt(JSON.stringify(data)) }) : undefined
    })
    
    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    const encrypted = encrypt(JSON.stringify({ error: 'Proxy failed' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}
