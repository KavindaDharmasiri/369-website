import type { PrismaClient } from '@prisma/client'
import { slugify, withSlugSuffix } from './slugs'

async function exists(
  prisma: PrismaClient,
  model: 'product' | 'category' | 'subCategory',
  slug: string,
  excludeId?: number,
  extraWhere?: Record<string, unknown>,
) {
  const where: any = { slug, ...(extraWhere || {}) }
  if (excludeId) where.id = { not: excludeId }
  if (model === 'product') return !!(await prisma.product.findFirst({ where, select: { id: true } }))
  if (model === 'category') return !!(await prisma.category.findFirst({ where, select: { id: true } }))
  return !!(await prisma.subCategory.findFirst({ where, select: { id: true } }))
}

export async function uniqueSlug(
  prisma: PrismaClient,
  model: 'product' | 'category' | 'subCategory',
  source: string,
  options: { excludeId?: number; extraWhere?: Record<string, unknown> } = {},
) {
  const base = slugify(source)
  let candidate = base
  let suffix = 2
  while (await exists(prisma, model, candidate, options.excludeId, options.extraWhere)) {
    candidate = withSlugSuffix(base, suffix++)
    if (suffix > 10000) throw new Error('Could not generate a unique slug')
  }
  return candidate
}
