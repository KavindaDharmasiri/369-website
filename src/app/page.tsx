import prisma from '@/lib/db'
import { listPublicCategories, listPublicProducts } from '@/lib/publicCatalog'
import LandingClient from './LandingClient'

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const [categories, products] = await Promise.all([
    listPublicCategories(prisma),
    listPublicProducts(prisma, { where: { featuredOnHomepage: true } }),
  ])
  return <LandingClient initialCategories={categories} initialFeaturedProducts={products} />
}
