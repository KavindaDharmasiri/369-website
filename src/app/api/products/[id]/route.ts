import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireAdmin } from '@/lib/apiMiddleware'
import { encrypt } from '@/lib/encryption'

const prisma = new PrismaClient()

const getHandler = async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(params.id) },
      include: { category: true, subCategory: true },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ data: encrypt(JSON.stringify(product)) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

const putHandler = async (req: NextRequest, user: any, { params }: { params: { id: string } }) => {
  try {
    const body = await req.json()

    const product = await prisma.product.update({
      where: { id: parseInt(params.id) },
      data: {
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
      },
    })

    return NextResponse.json({ data: encrypt(JSON.stringify(product)) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest, context: any) {
  return getHandler(req, context)
}
export const PUT = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => putHandler(r, u, context))(req)

const deleteHandler = async (req: NextRequest, user: any, { params }: { params: { id: string } }) => {
  try {
    const productId = parseInt(params.id)
    
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
