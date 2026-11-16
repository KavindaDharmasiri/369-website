import type { Metadata } from 'next'
import prisma from '@/lib/db'
import { listPublicProducts } from '@/lib/publicCatalog'
import { absoluteUrl } from '@/lib/siteUrl'
import ShopClient from './ShopClient'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ tab?: string; q?: string; search?: string }> }

export async function generateMetadata({ searchParams: pendingParams }: Props): Promise<Metadata> {
  const searchParams = await pendingParams
  const isNew = searchParams.tab === 'new'
  const query = [searchParams.search, searchParams.q].some(value => typeof value === 'string' && value.trim())
  if (query) return {
    title: 'Search results', description: 'Search results on 369.',
    alternates: { canonical: absoluteUrl('/customer/shop') },
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  }
  const canonical = absoluteUrl(isNew ? '/customer/shop?tab=new' : '/customer/shop')
  const title = isNew ? 'New arrivals' : 'Shop'
  const description = isNew ? 'Discover the latest new arrivals from 369.' : 'Shop the latest arrivals and curated collections from 369.'
  return { title, description, alternates: { canonical },
    openGraph: { title: `${title} | 369`, description, url: canonical } }
}

export default async function ShopPage({ searchParams: pendingParams }: Props) {
  const searchParams = await pendingParams
  const [featuredProducts, newArrivals] = await Promise.all([
    listPublicProducts(prisma, { where: { featuredOnHomepage: true } }),
    listPublicProducts(prisma, { where: { showInNewArrivals: true } }),
  ])
  return <ShopClient initialTab={searchParams.tab === 'new' ? 'new' : 'personalized'}
    initialFeaturedProducts={featuredProducts} initialNewArrivals={newArrivals} />
}
