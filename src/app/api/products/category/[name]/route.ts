import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { encrypt } from '@/lib/encryption'
import { listPublicProducts } from '@/lib/publicCatalog'
import { positiveId, ValidationError } from '@/lib/validation'

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params
    const { searchParams } = new URL(req.url)
    const sort = searchParams.get('sort') || 'newest'
    if (!['newest', 'oldest', 'price_low', 'price_high'].includes(sort)) throw new ValidationError('Invalid sort order')
    const limit = Math.min(positiveId(searchParams.get('limit') ?? 200, 'Limit'), 200)
    const products = await listPublicProducts(prisma, {
      where: { prodCategoryName: { equals: name, mode: 'insensitive' } },
      orderBy: sort === 'oldest' ? { createdAt: 'asc' } : { createdAt: 'desc' }, limit,
    })
    if (sort === 'price_low') products.sort((a, b) => Number(a.salePrice) - Number(b.salePrice))
    if (sort === 'price_high') products.sort((a, b) => Number(b.salePrice) - Number(a.salePrice))
    return NextResponse.json({ data: encrypt(JSON.stringify({ products })) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const status = error instanceof ValidationError ? error.status : 503
    const message = error instanceof ValidationError ? error.message : 'Catalog temporarily unavailable'
    return NextResponse.json({ data: encrypt(JSON.stringify({ error: message })) }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
