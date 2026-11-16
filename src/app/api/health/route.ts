import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { createReadinessProbe } from '@/lib/readiness'

export const dynamic = 'force-dynamic'
const probe = createReadinessProbe(() => prisma.$queryRaw`SELECT 1`)

export async function GET() {
  const dbConnected = await probe()

  return NextResponse.json({
    status: dbConnected ? 'ok' : 'unavailable',
  }, { status: dbConnected ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
