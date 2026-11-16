import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { encrypt } from '@/lib/encryption'
import { encryptData } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const productId = parseInt(id)

    const [reviews, aggregate] = await Promise.all([
      prisma.review.findMany({
        where: { productId, isActive: true },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.review.aggregate({
        where: { productId, isActive: true },
        _avg: { rating: true },
        _count: { _all: true }
      })
    ])

    const data = encrypt(JSON.stringify({
      reviews: reviews.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        authorName: [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || 'Anonymous'
      })),
      averageRating: aggregate._avg.rating ? Math.round(Number(aggregate._avg.rating) * 10) / 10 : 0,
      reviewCount: aggregate._count._all
    }))

    return NextResponse.json({ data })
  } catch (error: any) {
    logServerError('Get reviews error', error)
    const data = encrypt(JSON.stringify({ error: error.message || 'Failed to fetch reviews' }))
    return NextResponse.json({ data }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const decoded = await loadActiveUser(verifyToken(token))
    if (!decoded || !Number.isInteger(decoded.userId) || decoded.userId < 1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }
    if (decoded.userType === 'admin') {
      return NextResponse.json({ error: 'Admins cannot review products' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const { id } = await params
    const productId = parseInt(id)
    const { rating, comment } = await request.json()

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }
    if (!Number.isInteger(productId) || productId < 1) {
      return NextResponse.json({ error: 'Invalid product' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, isDeleted: true } })
    if (!product || product.isDeleted) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const review = await prisma.review.upsert({
      where: { userId_productId: { userId: decoded.userId, productId } },
      update: { rating, comment: comment || null },
      create: {
        userId: decoded.userId,
        productId,
        rating,
        comment: comment || null
      }
    })

    return NextResponse.json({ success: true, data: encryptData({ review }) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    logServerError('Create review error', error)
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
import { logServerError } from '@/lib/serverLog'
