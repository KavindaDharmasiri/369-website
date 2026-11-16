import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Liveness answers only whether this process can serve requests, not DB readiness.
export async function GET() {
  return NextResponse.json({ status: 'alive' }, { headers: { 'Cache-Control': 'no-store' } })
}
