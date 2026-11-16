import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { encrypt } from '@/lib/encryption'
import { listPublicProducts } from '@/lib/publicCatalog'
import { positiveId, ValidationError } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    if (q.length > 200) throw new ValidationError('Search query must be at most 200 characters')
    const limit = Math.min(positiveId(searchParams.get('limit') ?? 50, 'Limit'), 50)
    const fields = ['prodName', 'prodSubtitle', 'prodDescription', 'tagsCategory', 'tagsMeta', 'prodCategoryName', 'prodSubCategoryName']
    const products = q ? await listPublicProducts(prisma, { limit,
      where: { OR: fields.map(field => ({ [field]: { contains: q, mode: 'insensitive' } })) } }) : []
    return NextResponse.json({ data: encrypt(JSON.stringify({ products })) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const status = error instanceof ValidationError ? error.status : 503
    const message = error instanceof ValidationError ? error.message : 'Catalog temporarily unavailable'
    return NextResponse.json({ data: encrypt(JSON.stringify({ error: message })) }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
