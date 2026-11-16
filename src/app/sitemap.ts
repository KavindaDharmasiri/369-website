import type { MetadataRoute } from 'next'
import prisma from '@/lib/db'
import { absoluteUrl } from '@/lib/siteUrl'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: { status: 'ACTIVE', prodMarket: { in: ['MARKETPLACE', 'BOTH'] },
      isDeleted: false, category: { isActive: true }, subCategory: { isActive: true } },
      select: { id: true, updatedAt: true }, orderBy: { id: 'asc' }, take: 49998 }),
    prisma.category.findMany({ where: { isActive: true }, select: { name: true, updatedAt: true }, orderBy: { id: 'asc' } }),
  ])
  // During additive slug rollout, match the existing numeric/name canonicals.
  // Do not invent lastModified timestamps for static pages or outages.
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/') },
    { url: absoluteUrl('/customer/shop') },
  ]
  for (const category of categories) entries.push({
    url: absoluteUrl(`/customer/category?type=${encodeURIComponent(category.name.toLowerCase())}`),
    lastModified: category.updatedAt,
  })
  for (const product of products) entries.push({
    url: absoluteUrl(`/customer/product?id=${product.id}`), lastModified: product.updatedAt,
  })
  // Sitemap index/pagination must be introduced before reaching this size gate.
  if (entries.length > 50000) throw new Error('Catalog requires a split sitemap')
  return entries
}
