import { attachDiscountInfo } from './discounts'
import { publicProductSelect } from './publicProduct'

export async function listPublicProducts(db: any, options: {
  where?: Record<string, unknown>
  orderBy?: Record<string, unknown>
  limit?: number
} = {}) {
  const limit = options.limit ?? 50
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('Invalid catalog limit')
  const products = await db.product.findMany({
    where: { ...options.where, status: 'ACTIVE', prodMarket: 'MARKETPLACE', isDeleted: false,
      category: { isActive: true }, subCategory: { isActive: true } },
    select: { ...publicProductSelect, productImages: { orderBy: { isPrimary: 'desc' }, take: 5 } },
    orderBy: options.orderBy ?? { createdAt: 'desc' },
    take: limit,
  })
  // Date and Prisma Decimal must not cross an RSC boundary as custom objects.
  return JSON.parse(JSON.stringify(await attachDiscountInfo(db, products))) as any[]
}

export async function listPublicCategories(db: any) {
  const categories = await db.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true, isActive: true } })
  return JSON.parse(JSON.stringify(categories)) as any[]
}
