import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/apiMiddleware'
import { encrypt } from '@/lib/encryption'

const handler = async (req: NextRequest, user: any) => {
  try {
    const body = await req.json()

    const product = await prisma.product.create({
      data: {
        status: body.status || 'ACTIVE',
        stockStatus: body.stockStatus ?? true,
        prodMarket: body.prodMarket || 'DRAFT',
        prodType: body.prodType || 'Product',
        prodCategoryName: body.prodCategoryName,
        prodName: body.prodName,
        prodSubtitle: body.prodSubtitle,
        prodDescription: body.prodDescription,
        prodImg: body.prodImg,
        prodPrice: body.prodPrice,
        chargeTax: body.chargeTax ?? false,
        tagsCategory: body.tagsCategory,
        tagsMeta: body.tagsMeta,
        tagsGa4: body.tagsGa4,
        featuredOnHomepage: body.featuredOnHomepage ?? false,
        showInNewArrivals: body.showInNewArrivals ?? false,
        returnPolicyDoc: body.returnPolicyDoc,
        prodSubCategoryName: body.prodSubCategoryName,
        categoryId: parseInt(body.categoryId),
        subCategoryId: parseInt(body.subCategoryId),
        createdBy: user.email,
      },
    })

    const baseSku = await generateBaseSku(product.id, body.prodCategoryName, body.prodSubCategoryName)

    const updatedProduct = await prisma.product.update({
      where: { id: product.id },
      data: { baseSku },
    })

    return NextResponse.json({ data: encrypt(JSON.stringify(updatedProduct)) }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const POST = requireAdmin(handler)

async function generateBaseSku(productId: number, categoryName: string, subCategoryName: string) {
  const categoryIndex = await generateCommonIndex(categoryName, 'CATEGORY')
  const subCategoryIndex = await generateCommonIndex(subCategoryName, 'SUB_CATEGORY')

  return `${categoryIndex.code}/${subCategoryIndex.code}/${String(productId).padStart(6, '0')}`
}

async function generateCommonIndex(name: string, type: string) {
  const baseCode = name.length > 3 ? name.substring(0, 3).toUpperCase() : name.toUpperCase()

  const existing = await prisma.commonIndex.findUnique({ where: { name } })
  if (existing) return existing

  const count = await prisma.commonIndex.count({ where: { code: { contains: baseCode } } })

  const code = count > 0 ? `${baseCode}${count}` : baseCode

  return await prisma.commonIndex.create({
    data: { name, type, code },
  })
}

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isDeleted: false },
      include: { category: true, subCategory: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: encrypt(JSON.stringify({ products })) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
