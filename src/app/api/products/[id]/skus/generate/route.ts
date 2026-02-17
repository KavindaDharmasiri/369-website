import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireAdmin } from '@/lib/apiMiddleware'

const prisma = new PrismaClient()

const postHandler = async (req: NextRequest, user: any, { params }: { params: { id: string } }) => {
  try {
    const productId = parseInt(params.id)

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const specs = await prisma.productSpec.findMany({
      where: { productId },
      include: { attributes: true },
      orderBy: { orderNo: 'asc' },
    })

    if (specs.length === 0) {
      return NextResponse.json({ error: 'No specifications found' }, { status: 400 })
    }

    // Get existing SKUs
    const existingSkus = await prisma.productSku.findMany({ where: { productId } })
    const existingSkuCodes = new Set(existingSkus.map(sku => sku.skuCode))

    const attributeGroups = specs.map(spec => spec.attributes)
    const combinations = generateCombinations(attributeGroups)

    // Generate new SKU codes
    const newSkuCodes = new Set()
    const newSkusToCreate = []

    for (let index = 0; index < combinations.length; index++) {
      const combo = combinations[index]
      const variantCodes = combo.map(attr => {
        const code = attr.name.substring(0, 3).toUpperCase()
        return code
      })
      const skuCode = `${product.baseSku}-${variantCodes.join('-')}-${String(index + 1).padStart(3, '0')}`
      const variantKeys = combo.map(attr => attr.name).join(', ')
      const variantDetails = combo.map(attr => attr.value).join(', ')

      newSkuCodes.add(skuCode)

      // Only create if doesn't exist
      if (!existingSkuCodes.has(skuCode)) {
        newSkusToCreate.push({
          productId,
          skuCode,
          variantKeys,
          variantDetails,
          price: product.prodPrice,
          stock: 0,
        })
      }
    }

    // Remove SKUs that are no longer needed
    const skusToRemove = existingSkus.filter(sku => !newSkuCodes.has(sku.skuCode))
    if (skusToRemove.length > 0) {
      await prisma.productSku.deleteMany({
        where: {
          id: { in: skusToRemove.map(sku => sku.id) }
        }
      })
    }

    // Create new SKUs
    if (newSkusToCreate.length > 0) {
      await prisma.productSku.createMany({ data: newSkusToCreate })
    }

    // Return all current SKUs
    const allSkus = await prisma.productSku.findMany({
      where: { productId },
      orderBy: { id: 'asc' }
    })

    return NextResponse.json(allSkus, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function generateCombinations(groups: any[][]): any[] {
  if (groups.length === 0) return []
  if (groups.length === 1) return groups[0].map(item => [item])

  const result: any[] = []
  const restCombinations = generateCombinations(groups.slice(1))

  for (const item of groups[0]) {
    for (const combination of restCombinations) {
      result.push([item, ...combination])
    }
  }

  return result
}

export const POST = (req: NextRequest, context: any) => requireAdmin((r: NextRequest, u: any) => postHandler(r, u, context))(req)
