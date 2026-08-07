import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'

async function listHandler(request: NextRequest, user: any) {
  try {
    const discounts = await prisma.discount.findMany({
      include: {
        product: { select: { id: true, prodName: true } },
        category: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true, category: { select: { id: true, name: true } } } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    return NextResponse.json({ success: true, data: { discounts } })
  } catch (error) {
    console.error('Get discounts error:', error)
    return NextResponse.json({ error: 'Failed to fetch discounts' }, { status: 500 })
  }
}

async function createHandler(request: NextRequest, user: any) {
  try {
    const body = await request.json()
    const { name, description, discountType, discountValue, scope, productId, categoryId, subCategoryId, isActive, validFrom, validUntil } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Discount name is required' }, { status: 400 })
    }
    if (!discountValue || Number(discountValue) <= 0) {
      return NextResponse.json({ error: 'Discount value must be greater than 0' }, { status: 400 })
    }
    if (!['percentage', 'fixed'].includes(discountType || 'percentage')) {
      return NextResponse.json({ error: 'Invalid discount type' }, { status: 400 })
    }
    if (discountType === 'percentage' && Number(discountValue) > 100) {
      return NextResponse.json({ error: 'Percentage discount cannot exceed 100%' }, { status: 400 })
    }
    if (!['product', 'category', 'subcategory'].includes(scope || 'product')) {
      return NextResponse.json({ error: 'Invalid discount scope' }, { status: 400 })
    }

    const targetMap: Record<string, any> = {
      product: productId,
      category: categoryId,
      subcategory: subCategoryId
    }
    const target = targetMap[scope]

    if (!target) {
      return NextResponse.json({ error: 'Please select the target product or category' }, { status: 400 })
    }

    const discount = await prisma.discount.create({
      data: {
        name: name.trim(),
        description: description || null,
        discountType,
        discountValue: Number(discountValue),
        scope,
        productId: scope === 'product' ? Number(productId) : null,
        categoryId: scope === 'category' ? Number(categoryId) : null,
        subCategoryId: scope === 'subcategory' ? Number(subCategoryId) : null,
        isActive: isActive !== undefined ? isActive : true,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null
      }
    })

    return NextResponse.json({ success: true, data: { discount } }, { status: 201 })
  } catch (error) {
    console.error('Create discount error:', error)
    return NextResponse.json({ error: 'Failed to create discount' }, { status: 500 })
  }
}

export const GET = requireAdmin(listHandler)
export const POST = requireAdmin(createHandler)
