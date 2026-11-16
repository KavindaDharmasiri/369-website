import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin, loadActiveUser } from '@/lib/apiMiddleware'
import { verifyToken } from '@/lib/auth'
import { encrypt } from '@/lib/encryption'
import { attachDiscountInfo } from '@/lib/discounts'
import { uniqueSlug } from '@/lib/slugStore'
import { findPublicProduct, isPublicProduct, publicProductSelect } from '@/lib/publicProduct'

const getHandler = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const headers = { 'Cache-Control': 'private, no-store' }
    let admin = false
    if (req.headers.has('authorization')) {
      const token = req.headers.get('authorization')?.replace('Bearer ', '')
      const user = token ? await loadActiveUser(verifyToken(token)) : null
      if (!user) return NextResponse.json({ error: 'Invalid or inactive session' }, { status: 401, headers })
      admin = user.userType === 'admin'
    }
    const select = admin ? { ...publicProductSelect, tagsCategory: true, tagsMeta: true, tagsGa4: true,
      createdBy: true, updatedBy: true } : publicProductSelect
    const product = await findPublicProduct(prisma, (await params).id, select)
    if (!product || (!admin && !isPublicProduct(product))) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404, headers })
    }

    const enriched = await attachDiscountInfo(prisma, [product])

    return NextResponse.json({ data: encrypt(JSON.stringify(enriched[0])) }, { headers })
  } catch (error: any) {
    return NextResponse.json({ error: 'Product temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

const putHandler = async (req: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const body = await req.json()

    const numericId = parseInt((await params).id)
    if (!Number.isInteger(numericId)) {
      return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
    }

    const data: any = {
      status: body.status,
      stockStatus: body.stockStatus,
      prodMarket: body.prodMarket,
      prodType: body.prodType,
      prodCategoryName: body.prodCategoryName,
      prodName: body.prodName,
      prodSubtitle: body.prodSubtitle,
      prodDescription: body.prodDescription,
      prodImg: body.prodImg,
      prodPrice: body.prodPrice,
      chargeTax: body.chargeTax,
      tagsCategory: body.tagsCategory,
      tagsMeta: body.tagsMeta,
      tagsGa4: body.tagsGa4,
      featuredOnHomepage: body.featuredOnHomepage,
      showInNewArrivals: body.showInNewArrivals,
      returnPolicyDoc: body.returnPolicyDoc,
      prodSubCategoryName: body.prodSubCategoryName,
      categoryId: parseInt(body.categoryId),
      subCategoryId: parseInt(body.subCategoryId),
      updatedBy: user.email,
    }

    // S02 groundwork: assign slug only when missing; avoid auto-renaming existing slugs until history/redirects exist.
    try {
      const existing: any = await (prisma.product.findUnique as any)({ where: { id: numericId }, select: { id: true, slug: true } })
      if (existing && !existing.slug) {
        data.slug = await uniqueSlug(prisma, 'product', String(body.prodName || 'product'), { excludeId: numericId })
      }
    } catch (error: any) {
      if (!(error?.code === 'P2022' || /slug|Unknown arg/i.test(error?.message || ''))) throw error
    }

    let product
    try {
      product = await (prisma.product.update as any)({ where: { id: numericId }, data })
    } catch (error: any) {
      if (data.slug && (error?.code === 'P2022' || /slug|Unknown arg/i.test(error?.message || ''))) {
        delete data.slug
        product = await prisma.product.update({ where: { id: numericId }, data })
      } else {
        throw error
      }
    }

    return NextResponse.json({ data: encrypt(JSON.stringify(product)) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest, context: any) {
  return getHandler(req, context)
}
export const PUT = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => putHandler(r, u, context))(req)

const deleteHandler = async (req: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const productId = parseInt((await params).id)
    
    // Delete related data first
    await prisma.productImage.deleteMany({ where: { productId } })
    await prisma.productSku.deleteMany({ where: { productId } })
    
    // Delete specs and their attributes
    const specs = await prisma.productSpec.findMany({ where: { productId } })
    for (const spec of specs) {
      await prisma.productSpecAttr.deleteMany({ where: { specId: spec.id } })
    }
    await prisma.productSpec.deleteMany({ where: { productId } })
    
    // Finally delete the product
    await prisma.product.delete({ where: { id: productId } })
    
    return NextResponse.json({ data: encrypt(JSON.stringify({ success: true })) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const DELETE = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => deleteHandler(r, u, context))(req)
