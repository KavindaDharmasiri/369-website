import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireAdmin } from '@/lib/apiMiddleware'
import { encrypt } from '@/lib/encryption'

const prisma = new PrismaClient()

const getHandler = async (req: NextRequest, user: any, { params }: { params: { id: string } }) => {
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
        visiPage: body.visiPage,
        visiSection: body.visiSection,
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

export const GET = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => getHandler(r, u, context))(req)
export const PUT = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => putHandler(r, u, context))(req)
