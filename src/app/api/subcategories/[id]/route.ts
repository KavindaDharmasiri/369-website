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

  try {
    let subcategory: any
    try {
      subcategory = await prisma.subCategory.findUnique({
        where: { id: parseInt((await params).id) },
        include: { category: true }
      })
    } catch (error: any) {
      if (error?.code === 'P2022' || /slug|does not exist|Unknown arg/i.test(error?.message || '')) {
        subcategory = await prisma.subCategory.findUnique({
          where: { id: parseInt((await params).id) },
          select: {
            id: true, name: true, description: true, categoryId: true, isActive: true, createdAt: true,
            category: { select: { id: true, name: true, description: true, isActive: true, createdAt: true } },
          } as any,
        })
      } else throw error
    }
    if (!subcategory) {
      const encrypted = encrypt(JSON.stringify({ error: 'Sub category not found' }))
      return NextResponse.json({ data: encrypted }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const encrypted = encrypt(JSON.stringify({ subcategory }))
    return NextResponse.json({ data: encrypted }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const encrypted = encrypt(JSON.stringify({ error: 'Failed to fetch sub category' }))
    return NextResponse.json({ data: encrypted }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminAuth(req)
  if (!auth.authorized) return auth.response
  const privateNoStore = { 'Cache-Control': 'private, no-store' }

  try {
    const body = await req.json()
    const decryptedPayload = JSON.parse(decrypt(body.data))
    const { name, description, categoryId, isActive } = decryptedPayload

    if (!name || name.trim().length === 0) {
      const encrypted = encrypt(JSON.stringify({ error: 'Sub category name is required' }))
      return NextResponse.json({ data: encrypted }, { status: 400, headers: privateNoStore })
    }

    if (name.trim().length < 2) {
      const encrypted = encrypt(JSON.stringify({ error: 'Sub category name must be at least 2 characters' }))
      return NextResponse.json({ data: encrypted }, { status: 400, headers: privateNoStore })
    }

    if (!categoryId) {
      const encrypted = encrypt(JSON.stringify({ error: 'Category is required' }))
      return NextResponse.json({ data: encrypted }, { status: 400, headers: privateNoStore })
    }

    if (description && description.trim().length < 10) {
      const encrypted = encrypt(JSON.stringify({ error: 'Description must be at least 10 characters' }))
      return NextResponse.json({ data: encrypted }, { status: 400, headers: privateNoStore })
    }

    const subId = parseInt((await params).id)
    const parsedCategoryId = parseInt(categoryId)
    const data: any = {
      name: name.trim(),
      description: description?.trim() || null,
      categoryId: parsedCategoryId,
      isActive: isActive ?? true
    }

    try {
      const existing: any = await (prisma.subCategory.findUnique as any)({ where: { id: subId }, select: { id: true, slug: true } })
      if (existing && !existing.slug) {
        data.slug = await uniqueSlug(prisma, 'subCategory', name.trim(), { excludeId: subId, extraWhere: { categoryId: parsedCategoryId } })
      }
    } catch (error: any) {
      if (!(error?.code === 'P2022' || /slug|Unknown arg/i.test(error?.message || ''))) throw error
    }

    let subcategory
    const safeInclude = {
      category: { select: { id: true, name: true, description: true, isActive: true, createdAt: true } },
    } as const
    try {
      subcategory = await (prisma.subCategory.update as any)({ where: { id: subId }, data, include: { category: true } })
    } catch (error: any) {
      const slugIssue = error?.code === 'P2022' || /slug|Unknown arg|does not exist/i.test(error?.message || '')
      if (data.slug && slugIssue) {
        const fallbackData = { ...data }
        delete fallbackData.slug
        try {
          subcategory = await (prisma.subCategory.update as any)({ where: { id: subId }, data: fallbackData, include: { category: true } })
        } catch (error2: any) {
          if (error2?.code === 'P2022' || /slug|Unknown arg|does not exist/i.test(error2?.message || '')) {
            subcategory = await (prisma.subCategory.update as any)({ where: { id: subId }, data: fallbackData, include: safeInclude as any })
          } else throw error2
        }
      } else if (slugIssue) {
        subcategory = await (prisma.subCategory.update as any)({ where: { id: subId }, data, include: safeInclude as any })
      } else {
        throw error
      }
    }

    const encrypted = encrypt(JSON.stringify({ success: true, subcategory }))
    return NextResponse.json({ data: encrypted }, { headers: privateNoStore })
  } catch (error: any) {
    if (error.code === 'P2002') {
      const encrypted = encrypt(JSON.stringify({ error: 'Sub category name already exists in this category' }))
      return NextResponse.json({ data: encrypted }, { status: 409, headers: privateNoStore })
    }
    if (error.code === 'P2025') {
      const encrypted = encrypt(JSON.stringify({ error: 'Sub category not found' }))
      return NextResponse.json({ data: encrypted }, { status: 404, headers: privateNoStore })
    }
    const encrypted = encrypt(JSON.stringify({ error: 'Failed to update sub category' }))
    return NextResponse.json({ data: encrypted }, { status: 500, headers: privateNoStore })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminAuth(req)
  if (!auth.authorized) return auth.response
  const privateNoStore = { 'Cache-Control': 'private, no-store' }

  try {
    await prisma.subCategory.delete({ where: { id: parseInt((await params).id) } })
    const encrypted = encrypt(JSON.stringify({ success: true }))
    return NextResponse.json({ data: encrypted }, { headers: privateNoStore })
  } catch (error: any) {
    if (error.code === 'P2025') {
      const encrypted = encrypt(JSON.stringify({ error: 'Sub category not found' }))
      return NextResponse.json({ data: encrypted }, { status: 404, headers: privateNoStore })
    }
    const encrypted = encrypt(JSON.stringify({ error: 'Failed to delete sub category' }))
    return NextResponse.json({ data: encrypted }, { status: 500, headers: privateNoStore })
  }
}
