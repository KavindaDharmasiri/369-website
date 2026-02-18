import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { encrypt, decrypt } from '@/lib/encryption'
import { verifyToken } from '@/lib/auth'

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
    const subcategory = await prisma.subCategory.findUnique({ 
      where: { id: parseInt(params.id) },
      include: { category: true }
    })
    if (!subcategory) {
      const encrypted = encrypt(JSON.stringify({ error: 'Sub category not found' }))
      return NextResponse.json({ data: encrypted }, { status: 404 })
    }
    const encrypted = encrypt(JSON.stringify({ subcategory }))
    return NextResponse.json({ data: encrypted })
  } catch (error) {
    const encrypted = encrypt(JSON.stringify({ error: 'Failed to fetch sub category' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
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

    const subcategory = await prisma.subCategory.update({
      where: { id: parseInt(params.id) },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        categoryId: parseInt(categoryId),
        isActive: isActive ?? true
      },
      include: { category: true }
    })

    const encrypted = encrypt(JSON.stringify({ success: true, subcategory }))
    return NextResponse.json({ data: encrypted })
  } catch (error: any) {
    if (error.code === 'P2002') {
      const encrypted = encrypt(JSON.stringify({ error: 'Sub category name already exists in this category' }))
      return NextResponse.json({ data: encrypted }, { status: 409 })
    }
    if (error.code === 'P2025') {
      const encrypted = encrypt(JSON.stringify({ error: 'Sub category not found' }))
      return NextResponse.json({ data: encrypted }, { status: 404 })
    }
    const encrypted = encrypt(JSON.stringify({ error: 'Failed to update sub category' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = checkAdminAuth(req)
  if (!auth.authorized) return auth.response

  try {
    await prisma.subCategory.delete({ where: { id: parseInt(params.id) } })
    const encrypted = encrypt(JSON.stringify({ success: true }))
    return NextResponse.json({ data: encrypted })
  } catch (error: any) {
    if (error.code === 'P2025') {
      const encrypted = encrypt(JSON.stringify({ error: 'Sub category not found' }))
      return NextResponse.json({ data: encrypted }, { status: 404 })
    }
    const encrypted = encrypt(JSON.stringify({ error: 'Failed to delete sub category' }))
    return NextResponse.json({ data: encrypted }, { status: 500 })
  }
}
