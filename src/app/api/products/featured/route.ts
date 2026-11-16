import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { encrypt } from '@/lib/encryption'
import { listPublicProducts } from '@/lib/publicCatalog'

export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const products = await listPublicProducts(prisma, { where: { featuredOnHomepage: true } })
    return NextResponse.json({ data: encrypt(JSON.stringify({ products })) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Catalog temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
