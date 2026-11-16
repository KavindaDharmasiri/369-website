import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { encrypt } from '@/lib/encryption'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'

async function checkAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const privateNoStore = { 'Cache-Control': 'private, no-store' }
  if (!token) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateNoStore }) }
  const user = await loadActiveUser(verifyToken(token))
  if (!user || !Number.isInteger(user.userId) || user.userId < 1) {
    return { ok: false, res: NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: privateNoStore }) }
  }
  if (user.userType !== 'admin') {
    return { ok: false, res: NextResponse.json({ error: 'Admin access required' }, { status: 403, headers: privateNoStore }) }
  }
  return { ok: true, user }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdmin(request)
  if (!auth.ok) return auth.res

  try {
    const { id } = await params
    const body = await request.json()
    const { title, imageUrl, linkUrl, position, isActive } = body

    const banner = await prisma.adBanner.update({
      where: { id: parseInt(id) },
      data: {
        title,
        imageUrl,
        linkUrl: linkUrl || null,
        position: position || 'home',
        isActive: isActive ?? true,
      },
    })
    return NextResponse.json({ success: true, data: encrypt(JSON.stringify(banner)) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    }
    return NextResponse.json({ error: 'Failed to update banner' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdmin(request)
  if (!auth.ok) return auth.res

  try {
    const { id } = await params
    await prisma.adBanner.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    }
    return NextResponse.json({ error: 'Failed to delete banner' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
