import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireAdmin } from '@/lib/apiMiddleware'
import { encrypt, decrypt } from '@/lib/encryption'

const prisma = new PrismaClient()

const getHandler = async (req: NextRequest, user: any) => {
  try {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('categoryId')
    const name = searchParams.get('name')
    const description = searchParams.get('description')
    const activeOnly = searchParams.get('activeOnly')

    const where: any = {}
    if (categoryId) where.categoryId = parseInt(categoryId)
    if (name) where.name = { contains: name }
    if (description) where.description = { contains: description }
    if (activeOnly === 'true') where.isActive = true
    else if (activeOnly === 'false') where.isActive = false

    const subcategories = await prisma.subCategory.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    })

    const encrypted = encrypt(JSON.stringify({ subcategories }))
    return NextResponse.json({ data: encrypted })
  } catch (error: any) {
    const encrypted = encrypt(JSON.stringify({ error: error.message }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}

const postHandler = async (req: NextRequest, user: any) => {
  try {
    const body = await req.json()
    const decryptedPayload = JSON.parse(decrypt(body.data))
    const { name, description, categoryId, isActive } = decryptedPayload

    if (!name || name.trim().length < 2) {
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
        isActive: isActive ?? true,
      },
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

export const GET = requireAdmin(getHandler)
export const POST = requireAdmin(postHandler)
