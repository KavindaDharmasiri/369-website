import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { encrypt, decrypt } from '@/lib/encryption'
import { verifyToken } from '@/lib/auth'

const prisma = new PrismaClient()

function checkAdminAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    const encrypted = encrypt(JSON.stringify({ error: 'Unauthorized' }))
    return { authorized: false, response: NextResponse.json({ data: encrypted }, { status: 401 }) }
  }

  const user = verifyToken(token)
  if (!user || user.userType !== 'admin') {
    const encrypted = encrypt(JSON.stringify({ error: 'Admin access required' }))
    return { authorized: false, response: NextResponse.json({ data: encrypted }, { status: 403 }) }
  }

  return { authorized: true, user }
}

export async function POST(req: NextRequest) {
  const auth = checkAdminAuth(req)
  if (!auth.authorized) return auth.response

  try {
    const body = await req.json()
    const decryptedPayload = JSON.parse(decrypt(body.data))
    const { name, description, categoryId, isActive } = decryptedPayload

    if (!name || name.trim().length === 0) {
      const encrypted = encrypt(JSON.stringify({ error: 'Sub category name is required' }))
      return NextResponse.json({ data: encrypted }, { status: 400 })
    }

    if (name.trim().length < 2) {
      const encrypted = encrypt(JSON.stringify({ error: 'Sub category name must be at least 2 characters' }))
      return NextResponse.json({ data: encrypted }, { status: 400 })
    }

    if (!categoryId) {
      const encrypted = encrypt(JSON.stringify({ error: 'Category is required' }))
      return NextResponse.json({ data: encrypted }, { status: 400 })
    }

    if (description && description.trim().length < 10) {
      const encrypted = encrypt(JSON.stringify({ error: 'Description must be at least 10 characters' }))
      return NextResponse.json({ data: encrypted }, { status: 400 })
    }

    const subcategory = await prisma.subCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        categoryId: parseInt(categoryId),
        isActive: isActive ?? true
      },
      include: { category: true }
    })

    const encrypted = encrypt(JSON.stringify({ success: true, subcategory }))
    return NextResponse.json({ data: encrypted }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      const encrypted = encrypt(JSON.stringify({ error: 'Sub category name already exists in this category' }))
      return NextResponse.json({ data: encrypted }, { status: 409 })
    }
    const encrypted = encrypt(JSON.stringify({ error: 'Failed to create sub category' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const auth = checkAdminAuth(req)
  if (!auth.authorized) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name')
    const description = searchParams.get('description')
    const activeOnly = searchParams.get('activeOnly')

    const where: any = {}
    if (name) where.name = { contains: name }
    if (description) where.description = { contains: description }
    if (activeOnly === 'true') {
      where.isActive = true
    } else if (activeOnly === 'false') {
      where.isActive = false
    }

    const subcategories = await prisma.subCategory.findMany({ 
      where, 
      include: { category: true },
      orderBy: { createdAt: 'desc' } 
    })
    const encrypted = encrypt(JSON.stringify({ subcategories }))
    return NextResponse.json({ data: encrypted })
  } catch (error) {
    const encrypted = encrypt(JSON.stringify({ error: 'Failed to fetch sub categories' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}
