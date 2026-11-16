import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { encryptData } from '@/lib/encryption'
import { getActiveDiscounts, bestDiscountForProduct, buildDiscountInfo } from '@/lib/discounts'

const getHandler = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { searchParams } = new URL(req.url)
    const variantKeys = searchParams.get('variantKeys')
    
    const where: any = { productId: parseInt((await params).id) }
    if (variantKeys) {
      where.variantKeys = variantKeys
    }
    
    const skus = await prisma.productSku.findMany({
      where,
      orderBy: { id: 'asc' },
    })

    const product = await prisma.product.findUnique({
      where: { id: parseInt((await params).id) },
      select: { id: true, prodPrice: true, categoryId: true, subCategoryId: true }
    })

    if (skus.length > 0 && product) {
      const discounts = await getActiveDiscounts(prisma)
      return NextResponse.json({
        data: encryptData(skus.map((sku: any) => {
          const best = bestDiscountForProduct(discounts, product, Number(sku.price))
          const info = buildDiscountInfo(Number(sku.price), best)
          return { ...sku, ...info }
        }))
      })
    }

    return NextResponse.json({ data: encryptData(skus) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest, context: any) {
  return getHandler(req, context)
}
