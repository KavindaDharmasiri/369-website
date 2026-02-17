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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = checkAdminAuth(req)
  if (!auth.authorized) return auth.response

  try {
    const category = await prisma.category.findUnique({ where: { id: parseInt(params.id) } })
    if (!category) {
      const encrypted = encrypt(JSON.stringify({ error: 'Category not found' }))
      return NextResponse.json({ data: encrypted }, { status: 404 })
    }
    const encrypted = encrypt(JSON.stringify({ category }))
    return NextResponse.json({ data: encrypted })
  } catch (error) {
    const encrypted = encrypt(JSON.stringify({ error: 'Failed to fetch category' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = checkAdminAuth(req)
  if (!auth.authorized) return auth.response

  try {
    const body = await req.json()
    const decryptedPayload = JSON.parse(decrypt(body.data))
    const { name, description, isActive } = decryptedPayload

    if (!name || name.trim().length === 0) {
      const encrypted = encrypt(JSON.stringify({ error: 'Category name is required' }))
      return NextResponse.json({ data: encrypted }, { status: 400 })
    }

    if (name.trim().length < 2) {
      const encrypted = encrypt(JSON.stringify({ error: 'Category name must be at least 2 characters' }))
      return NextResponse.json({ data: encrypted }, { status: 400 })
    }

    if (description && description.trim().length < 10) {
      const encrypted = encrypt(JSON.stringify({ error: 'Description must be at least 10 characters' }))
      return NextResponse.json({ data: encrypted }, { status: 400 })
    }

    const category = await prisma.category.update({
      where: { id: parseInt(params.id) },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isActive: isActive ?? true
      }
    })

    // If category is set to inactive, also set all its subcategories to inactive
    if (isActive === false) {
      await prisma.subCategory.updateMany({
        where: { categoryId: parseInt(params.id) },
        data: { isActive: false }
      })
    }

    const encrypted = encrypt(JSON.stringify({ success: true, category }))
    return NextResponse.json({ data: encrypted })
  } catch (error: any) {
    if (error.code === 'P2002') {
      const encrypted = encrypt(JSON.stringify({ error: 'Category name already exists' }))
      return NextResponse.json({ data: encrypted }, { status: 409 })
    }
    if (error.code === 'P2025') {
      const encrypted = encrypt(JSON.stringify({ error: 'Category not found' }))
      return NextResponse.json({ data: encrypted }, { status: 404 })
    }
    const encrypted = encrypt(JSON.stringify({ error: 'Failed to update category' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = checkAdminAuth(req)
  if (!auth.authorized) return auth.response

  try {
    // Check if category has subcategories
    const subcategoryCount = await prisma.subCategory.count({
      where: { categoryId: parseInt(params.id) }
    })

    if (subcategoryCount > 0) {
      const encrypted = encrypt(JSON.stringify({ 
        error: `Cannot delete category. It has ${subcategoryCount} subcategory(ies). Please delete or reassign them first.` 
      }))
      return NextResponse.json({ data: encrypted }, { status: 400 })
    }

    await prisma.category.delete({ where: { id: parseInt(params.id) } })
    const encrypted = encrypt(JSON.stringify({ success: true }))
    return NextResponse.json({ data: encrypted })
  } catch (error: any) {
    if (error.code === 'P2025') {
      const encrypted = encrypt(JSON.stringify({ error: 'Category not found' }))
      return NextResponse.json({ data: encrypted }, { status: 404 })
    }
    const encrypted = encrypt(JSON.stringify({ error: 'Failed to delete category' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}
