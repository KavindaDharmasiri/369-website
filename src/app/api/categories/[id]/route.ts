import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { encrypt, decrypt } from '@/lib/encryption'
import { verifyToken } from '@/lib/auth'
import { loadActiveUser } from '@/lib/apiMiddleware'
import { uniqueSlug } from '@/lib/slugStore'

async function checkAdminAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const privateNoStore = { 'Cache-Control': 'private, no-store' }

  if (!token) {
    const encrypted = encrypt(JSON.stringify({ error: 'Unauthorized' }))
    return { authorized: false, response: NextResponse.json({ data: encrypted }, { status: 401, headers: privateNoStore }) }
  }

  const user = await loadActiveUser(verifyToken(token))
  if (!user || !Number.isInteger(user.userId) || user.userId < 1) {
    const encrypted = encrypt(JSON.stringify({ error: 'Invalid token' }))
    return { authorized: false, response: NextResponse.json({ data: encrypted }, { status: 401, headers: privateNoStore }) }
  }
  if (user.userType !== 'admin') {
    const encrypted = encrypt(JSON.stringify({ error: 'Admin access required' }))
    return { authorized: false, response: NextResponse.json({ data: encrypted }, { status: 403, headers: privateNoStore }) }
  }

  return { authorized: true, user }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminAuth(req)
  if (!auth.authorized) return auth.response
  const privateNoStore = { 'Cache-Control': 'private, no-store' }

  try {
    let category: any
    try {
      category = await prisma.category.findUnique({ where: { id: parseInt((await params).id) } })
    } catch (error: any) {
      if (error?.code === 'P2022' || /slug|does not exist|Unknown arg/i.test(error?.message || '')) {
        category = await prisma.category.findUnique({
          where: { id: parseInt((await params).id) },
          select: { id: true, name: true, description: true, isActive: true, createdAt: true },
        })
      } else throw error
    }
    if (!category) {
      const encrypted = encrypt(JSON.stringify({ error: 'Category not found' }))
      return NextResponse.json({ data: encrypted }, { status: 404, headers: privateNoStore })
    }
    const encrypted = encrypt(JSON.stringify({ category }))
    return NextResponse.json({ data: encrypted }, { headers: privateNoStore })
  } catch (error) {
    const encrypted = encrypt(JSON.stringify({ error: 'Failed to fetch category' }))
    return NextResponse.json({ data: encrypted }, { status: 500, headers: privateNoStore })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminAuth(req)
  if (!auth.authorized) return auth.response
  const privateNoStore = { 'Cache-Control': 'private, no-store' }

  try {
    const body = await req.json()
    const decryptedPayload = JSON.parse(decrypt(body.data))
    const { name, description, isActive } = decryptedPayload

    if (!name || name.trim().length === 0) {
      const encrypted = encrypt(JSON.stringify({ error: 'Category name is required' }))
      return NextResponse.json({ data: encrypted }, { status: 400, headers: privateNoStore })
    }

    if (name.trim().length < 2) {
      const encrypted = encrypt(JSON.stringify({ error: 'Category name must be at least 2 characters' }))
      return NextResponse.json({ data: encrypted }, { status: 400, headers: privateNoStore })
    }

    if (description && description.trim().length < 10) {
      const encrypted = encrypt(JSON.stringify({ error: 'Description must be at least 10 characters' }))
      return NextResponse.json({ data: encrypted }, { status: 400, headers: privateNoStore })
    }

    const categoryId = parseInt((await params).id)
    const data: any = {
      name: name.trim(),
      description: description?.trim() || null,
      isActive: isActive ?? true
    }

    try {
      const existing: any = await (prisma.category.findUnique as any)({ where: { id: categoryId }, select: { id: true, slug: true } })
      if (existing && !existing.slug) {
        data.slug = await uniqueSlug(prisma, 'category', name.trim(), { excludeId: categoryId })
      }
    } catch (error: any) {
      if (!(error?.code === 'P2022' || /slug|Unknown arg/i.test(error?.message || ''))) throw error
    }

    let category
    try {
      category = await (prisma.category.update as any)({ where: { id: categoryId }, data })
    } catch (error: any) {
      if (data.slug && (error?.code === 'P2022' || /slug|Unknown arg/i.test(error?.message || ''))) {
        delete data.slug
        category = await prisma.category.update({ where: { id: categoryId }, data })
      } else {
        throw error
      }
    }

    // If category is set to inactive, also set all its subcategories to inactive
    if (isActive === false) {
      await prisma.subCategory.updateMany({
        where: { categoryId },
        data: { isActive: false }
      })
    }

    const encrypted = encrypt(JSON.stringify({ success: true, category }))
    return NextResponse.json({ data: encrypted }, { headers: privateNoStore })
  } catch (error: any) {
    if (error.code === 'P2002') {
      const encrypted = encrypt(JSON.stringify({ error: 'Category name already exists' }))
      return NextResponse.json({ data: encrypted }, { status: 409, headers: privateNoStore })
    }
    if (error.code === 'P2025') {
      const encrypted = encrypt(JSON.stringify({ error: 'Category not found' }))
      return NextResponse.json({ data: encrypted }, { status: 404, headers: privateNoStore })
    }
    const encrypted = encrypt(JSON.stringify({ error: 'Failed to update category' }))
    return NextResponse.json({ data: encrypted }, { status: 500, headers: privateNoStore })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminAuth(req)
  if (!auth.authorized) return auth.response

  const encrypted = encrypt(JSON.stringify({
    error: 'Categories are protected and cannot be deleted.'
  }))
  return NextResponse.json({ data: encrypted }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
}
