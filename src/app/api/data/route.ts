import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: 'Hello from 369 Website API',
    timestamp: new Date().toISOString()
  })
}
