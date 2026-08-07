import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { encrypt } from '@/lib/encryption'
import { verifyToken } from '@/lib/auth'

function checkAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const user = verifyToken(token)
  if (!user || user.userType !== 'admin') {
    return { ok: false, res: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }
  return { ok: true, user }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const position = searchParams.get('position') || 'home'

    const isPublicFetch = !request.headers.get('authorization')
    const where = isPublicFetch
      ? { position, isActive: true }
      : position === 'all'
        ? {}
        : { position }
    const banners = await prisma.adBanner.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: isPublicFetch ? 20 : 100,
    })

    const headers = isPublicFetch
      ? { 'Cache-Control': 'public, s-maxage=300, max-age=300, stale-while-revalidate=600' }
      : undefined

    return NextResponse.json({ data: encrypt(JSON.stringify({ banners })) }, headers ? { headers } : undefined)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch banners' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = checkAdmin(request)
  if (!auth.ok) return auth.res

  try {
    const body = await request.json()
    const { title, imageUrl, linkUrl, position, isActive } = body

    if (!title || !imageUrl) {
      return NextResponse.json({ error: 'Title and image are required' }, { status: 400 })
    }

    const banner = await prisma.adBanner.create({
      data: {
        title,
        imageUrl,
        linkUrl: linkUrl || null,
        position: position || 'home',
        isActive: isActive ?? true,
      },
    })
    return NextResponse.json({ success: true, data: encrypt(JSON.stringify(banner)) }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 })
  }
}
