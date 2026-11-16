import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/apiMiddleware'
import { encrypt } from '@/lib/encryption'
import { getAppSettings } from '@/lib/settings'
import { uniqueSlug } from '@/lib/slugStore'

const handler = async (req: NextRequest, user: any) => {
  try {
    const body = await req.json()

    const baseData: any = {
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
    }

    let product
    try {
      const slug = await uniqueSlug(prisma, 'product', String(body.prodName || 'product'))
      product = await (prisma.product.create as any)({ data: { ...baseData, slug } })
    } catch (error: any) {
      // Slug column/migration may not be applied yet; preserve existing behavior.
      if (error?.code === 'P2022' || /slug|Unknown arg/i.test(error?.message || '')) {
        product = await prisma.product.create({ data: baseData })
      } else {
        throw error
      }
    }

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

async function listHandler(req: NextRequest, user: any) {
  try {
    const settings = await getAppSettings()
    const threshold = settings.lowStockThreshold ?? 10
    let products: any[]
    try {
      products = await prisma.product.findMany({
        where: { isDeleted: false },
        include: {
          category: true,
          subCategory: true,
          productSkus: { select: { stock: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 200
      })
    } catch (error: any) {
      if (error?.code === 'P2022' || /slug|does not exist|Unknown arg/i.test(error?.message || '')) {
        products = await prisma.product.findMany({
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 200,
          select: {
            id: true, status: true, stockStatus: true, prodMarket: true, prodType: true,
            prodCategoryName: true, prodSubCategoryName: true, prodName: true, prodSubtitle: true,
            prodDescription: true, prodImg: true, prodPrice: true, chargeTax: true,
            tagsCategory: true, tagsMeta: true, tagsGa4: true, featuredOnHomepage: true,
            showInNewArrivals: true, returnPolicyDoc: true, categoryId: true, subCategoryId: true,
            baseSku: true, isDeleted: true, createdAt: true, updatedAt: true, createdBy: true, updatedBy: true,
            category: { select: { id: true, name: true, description: true, isActive: true, createdAt: true } },
            subCategory: { select: { id: true, name: true, description: true, categoryId: true, isActive: true, createdAt: true } },
            productSkus: { select: { stock: true } },
          } as any,
        })
      } else throw error
    }
    const enriched = products.map((p: any) => {
      const { productSkus, ...rest } = p
      const totalStock = productSkus.reduce((sum: number, s: any) => sum + s.stock, 0)
      return { ...rest, totalStock, skuCount: productSkus.length, lowStock: totalStock <= threshold }
    })
    enriched.sort((a: any, b: any) => Number(b.lowStock) - Number(a.lowStock))
    return NextResponse.json({ data: encrypt(JSON.stringify({ products: enriched })) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const GET = requireAdmin(listHandler)
