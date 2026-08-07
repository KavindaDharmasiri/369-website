import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'

async function updateHandler(request: NextRequest, user: any, context: any) {
  try {
    const id = parseInt(context.params.id)
    const body = await request.json()
    const { name, description, discountType, discountValue, scope, productId, categoryId, subCategoryId, isActive, validFrom, validUntil } = body

    const existing = await prisma.discount.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404 })
    }

    if (discountType && !['percentage', 'fixed'].includes(discountType)) {
      return NextResponse.json({ error: 'Invalid discount type' }, { status: 400 })
    }
    if (discountValue !== undefined && Number(discountValue) <= 0) {
      return NextResponse.json({ error: 'Discount value must be greater than 0' }, { status: 400 })
    }
    if (discountType === 'percentage' && discountValue !== undefined && Number(discountValue) > 100) {
      return NextResponse.json({ error: 'Percentage discount cannot exceed 100%' }, { status: 400 })
    }

    const effectiveScope = scope || existing.scope
    if (effectiveScope === 'product' && (productId !== undefined || !existing.productId)) {
      if (productId === undefined || productId === null || productId === '') {
        return NextResponse.json({ error: 'Please select the product' }, { status: 400 })
      }
    }
    if (effectiveScope === 'category' && (categoryId !== undefined || !existing.categoryId)) {
      if (categoryId === undefined || categoryId === null || categoryId === '') {
        return NextResponse.json({ error: 'Please select the category' }, { status: 400 })
      }
    }
    if (effectiveScope === 'subcategory' && (subCategoryId !== undefined || !existing.subCategoryId)) {
      if (subCategoryId === undefined || subCategoryId === null || subCategoryId === '') {
        return NextResponse.json({ error: 'Please select the sub category' }, { status: 400 })
      }
    }

    const discount = await prisma.discount.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description || null : undefined,
        discountType: discountType || undefined,
        discountValue: discountValue !== undefined ? Number(discountValue) : undefined,
        scope: scope || undefined,
        productId: scope === 'product' ? (productId !== undefined ? Number(productId) : existing.productId) : undefined,
        categoryId: scope === 'category' ? (categoryId !== undefined ? Number(categoryId) : existing.categoryId) : undefined,
        subCategoryId: scope === 'subcategory' ? (subCategoryId !== undefined ? Number(subCategoryId) : existing.subCategoryId) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        validFrom: validFrom !== undefined ? (validFrom ? new Date(validFrom) : null) : undefined,
        validUntil: validUntil !== undefined ? (validUntil ? new Date(validUntil) : null) : undefined
      }
    })

    return NextResponse.json({ success: true, data: { discount } })
  } catch (error) {
    console.error('Update discount error:', error)
    return NextResponse.json({ error: 'Failed to update discount' }, { status: 500 })
  }
}

async function deleteHandler(request: NextRequest, user: any, context: any) {
  try {
    const id = parseInt(context.params.id)

    const existing = await prisma.discount.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404 })
    }

    await prisma.discount.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete discount error:', error)
    return NextResponse.json({ error: 'Failed to delete discount' }, { status: 500 })
  }
}

export const PATCH = requireAdmin(updateHandler)
export const DELETE = requireAdmin(deleteHandler)
