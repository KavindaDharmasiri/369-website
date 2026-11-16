import { PrismaClient } from '@prisma/client'

function slugify(value, maxLength = 80) {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
  return slug || 'item'
}

function withSuffix(base, suffix, maxLength = 80) {
  const tail = `-${suffix}`
  const head = base.slice(0, Math.max(1, maxLength - tail.length)).replace(/-+$/g, '')
  return `${head}${tail}`
}

async function uniqueProductSlug(prisma, name, excludeId) {
  const base = slugify(name)
  let candidate = base
  let suffix = 2
  for (;;) {
    const found = await prisma.product.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
    if (!found) return candidate
    candidate = withSuffix(base, suffix++)
  }
}

async function uniqueCategorySlug(prisma, name, excludeId) {
  const base = slugify(name)
  let candidate = base
  let suffix = 2
  for (;;) {
    const found = await prisma.category.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
    if (!found) return candidate
    candidate = withSuffix(base, suffix++)
  }
}

async function uniqueSubCategorySlug(prisma, name, categoryId, excludeId) {
  const base = slugify(name)
  let candidate = base
  let suffix = 2
  for (;;) {
    const found = await prisma.subCategory.findFirst({
      where: { slug: candidate, categoryId, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
    if (!found) return candidate
    candidate = withSuffix(base, suffix++)
  }
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const [products, categories, subcategories] = await Promise.all([
      prisma.product.findMany({ select: { id: true, prodName: true, slug: true }, orderBy: { id: 'asc' } }),
      prisma.category.findMany({ select: { id: true, name: true, slug: true }, orderBy: { id: 'asc' } }),
      prisma.subCategory.findMany({ select: { id: true, name: true, slug: true, categoryId: true }, orderBy: { id: 'asc' } }),
    ])

    let updated = 0

    for (const category of categories) {
      if (category.slug) continue
      const slug = await uniqueCategorySlug(prisma, category.name, category.id)
      await prisma.category.update({ where: { id: category.id }, data: { slug } })
      category.slug = slug
      updated++
    }

    for (const sub of subcategories) {
      if (sub.slug) continue
      const slug = await uniqueSubCategorySlug(prisma, sub.name, sub.categoryId, sub.id)
      await prisma.subCategory.update({ where: { id: sub.id }, data: { slug } })
      sub.slug = slug
      updated++
    }

    for (const product of products) {
      if (product.slug) continue
      const slug = await uniqueProductSlug(prisma, product.prodName, product.id)
      await prisma.product.update({ where: { id: product.id }, data: { slug } })
      product.slug = slug
      updated++
    }

    console.log(`Backfill complete. Updated ${updated} records.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Slug backfill failed:', error)
  process.exit(1)
})
