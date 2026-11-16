import type { Metadata } from 'next'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import prisma from '@/lib/db'
import { absoluteUrl } from '@/lib/siteUrl'
import { resolveSlugRedirect } from '@/lib/slugRedirects'
import { listPublicProducts } from '@/lib/publicCatalog'
import CategoryClient from './CategoryClient'

export const dynamic = 'force-dynamic'
type Props = { searchParams: Promise<{ type?: string }> }

async function findActiveCategory(type: string): Promise<{ id: number; name: string } | null> {
  if (!type) return null
  const byName = await prisma.category.findFirst({
    where: { name: { equals: type, mode: 'insensitive' }, isActive: true },
    select: { id: true, name: true },
  })
  if (byName) return byName
  try {
    return await prisma.category.findFirst({ where: { slug: type, isActive: true }, select: { id: true, name: true } })
  } catch (error: any) {
    if (error?.code === 'P2022' && /slug/i.test(String(error?.meta?.column || error?.message || ''))) return null
    throw error
  }
}

export async function generateMetadata({ searchParams: pendingParams }: Props): Promise<Metadata> {
  const searchParams = await pendingParams
  const type = typeof searchParams.type === 'string' ? searchParams.type.trim().toLowerCase() : ''
  const category = await findActiveCategory(type)
  if (!category) return { title: 'Collection not found', robots: { index: false, follow: true } }
  const canonical = absoluteUrl(`/customer/category?type=${encodeURIComponent(category.name.toLowerCase())}`)
  const description = `Shop the ${category.name} collection at 369.`
  return { title: `${category.name} collection`, description, alternates: { canonical },
    openGraph: { title: `${category.name} collection | 369`, description, url: canonical } }
}

export default async function CategoryPage({ searchParams: pendingParams }: Props) {
  const searchParams = await pendingParams
  const type = typeof searchParams.type === 'string' ? searchParams.type.trim().toLowerCase() : ''
  if (!type) redirect('/customer/shop')
  const category = await findActiveCategory(type)
  if (!category) {
    const mapped = await resolveSlugRedirect(`/customer/category?type=${encodeURIComponent(type)}`)
    if (mapped) permanentRedirect(mapped.toPath)
    notFound()
  }
  // Keep name-based canonical URLs during the compatibility period. This also
  // prevents client sort/filter APIs from accidentally querying a slug as a name.
  const canonicalType = category.name.toLowerCase()
  if (type !== canonicalType) permanentRedirect(`/customer/category?type=${encodeURIComponent(canonicalType)}`)
  const [products, subCategories] = await Promise.all([
    listPublicProducts(prisma, { where: { categoryId: category.id }, limit: 200 }),
    prisma.subCategory.findMany({ where: { categoryId: category.id, isActive: true }, orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true, categoryId: true, isActive: true } }),
  ])
  return <CategoryClient initialType={canonicalType} initialProducts={products} initialSubCategories={subCategories} />
}
