import type { Metadata } from 'next'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import prisma from '@/lib/db'
import { absoluteUrl, getSiteUrl } from '@/lib/siteUrl'
import { resolveSlugRedirect } from '@/lib/slugRedirects'
import { attachDiscountInfo, getActiveDiscounts, bestDiscountForProduct, buildDiscountInfo } from '@/lib/discounts'
import ProductClient from './ProductClient'
import { findPublicProduct, isPublicProduct } from '@/lib/publicProduct'
import { buildProductSchema, serializeJsonLd } from '@/lib/productSeo'
import { listPublicProducts } from '@/lib/publicCatalog'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ id?: string; sku?: string }>
}

async function getProduct(idParam?: string) {
  return findPublicProduct(prisma, idParam)
}

export async function generateMetadata({ searchParams: pendingParams }: Props): Promise<Metadata> {
  const searchParams = await pendingParams
  const idParam = searchParams.id
  const product = await getProduct(idParam)
  const canonical = product ? absoluteUrl(`/customer/product?id=${product.id}`) : absoluteUrl('/customer/shop')

  if (!idParam || !product || !isPublicProduct(product)) {
    return {
      title: 'Product',
      description: 'View product details at 369.',
      robots: { index: false, follow: false },
      alternates: { canonical },
    }
  }

  const name = String(product.prodName || 'Product')
  const description = String(product.prodSubtitle || product.prodDescription || 'View product details, pricing, availability and options at 369.')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
  const image = product.prodImg || undefined

  return {
    title: name,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title: `${name} | 369`,
      description,
      url: canonical,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} | 369`,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function ProductPage({ searchParams: pendingParams }: Props) {
  const searchParams = await pendingParams
  const idParam = searchParams.id
  if (!idParam) notFound()
  const product = await getProduct(idParam)
  if (!product || !isPublicProduct(product)) {
    const mapped = await resolveSlugRedirect(`/customer/product?id=${encodeURIComponent(idParam)}`)
    if (mapped) {
      if (mapped.statusCode === 308) permanentRedirect(mapped.toPath)
      redirect(mapped.toPath)
    }
    notFound()
  }
  const publicProduct = product

  let initialProduct: any = null
  let initialImages: string[] = []
  let initialSpecs: any[] = []
  let initialReviews: { reviews: any[]; averageRating: number; reviewCount: number } | null = null
  let initialRelatedProducts: any[] = []
  let initialSkus: any[] | null = null
  let verifiedProductForSeo: any = null
  try {
    const [enrichedProducts, imageRows, specs, reviewRows, aggregate, relatedRaw] = await Promise.all([
      attachDiscountInfo(prisma, [publicProduct as any]),
      prisma.productImage.findMany({
        where: { productId: publicProduct.id },
        orderBy: { isPrimary: 'desc' },
        select: { imageUrl: true },
      }),
      prisma.productSpec.findMany({
        where: { productId: publicProduct.id },
        include: { attributes: true },
        orderBy: { orderNo: 'asc' },
      }),
      prisma.review.findMany({
        where: { productId: publicProduct.id, isActive: true },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.review.aggregate({
        where: { productId: publicProduct.id, isActive: true },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      listPublicProducts(prisma, { where: { categoryId: publicProduct.categoryId, id: { not: publicProduct.id } }, limit: 4 }),
    ])
    initialProduct = enrichedProducts?.[0] || publicProduct
    initialImages = imageRows.map((img: any) => img.imageUrl).filter(Boolean)
    initialSpecs = specs || []
    initialReviews = {
      reviews: reviewRows.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        authorName: [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || 'Anonymous',
      })),
      averageRating: aggregate._avg.rating ? Math.round(Number(aggregate._avg.rating) * 10) / 10 : 0,
      reviewCount: aggregate._count._all,
    }
    initialRelatedProducts = relatedRaw
  } catch {
    // Preserve client behavior/fallback on server-side data fetch failure.
  }

  try {
    const [skus, discounts] = await Promise.all([
      prisma.productSku.findMany({ where: { productId: publicProduct.id }, orderBy: { id: 'asc' },
        select: { id: true, skuCode: true, variantKeys: true, price: true, stock: true, images: true, isActive: true } }),
      getActiveDiscounts(prisma),
    ])
    initialSkus = skus.map(sku => ({ ...sku,
      ...buildDiscountInfo(Number(sku.price), bestDiscountForProduct(discounts, publicProduct, Number(sku.price))) }))
    verifiedProductForSeo = { ...publicProduct,
      ...buildDiscountInfo(Number(publicProduct.prodPrice), bestDiscountForProduct(discounts, publicProduct)) }
  } catch {
    // Unknown SKU availability is not evidence for an in-stock structured offer.
  }

  if (initialProduct) initialProduct = JSON.parse(JSON.stringify(initialProduct))
  initialSpecs = JSON.parse(JSON.stringify(initialSpecs))
  initialRelatedProducts = JSON.parse(JSON.stringify(initialRelatedProducts))
  if (initialReviews) initialReviews = JSON.parse(JSON.stringify(initialReviews))
  if (initialSkus) initialSkus = JSON.parse(JSON.stringify(initialSkus))

  const siteUrl = getSiteUrl()
  const canonical = absoluteUrl(`/customer/product?id=${publicProduct.id}`)
  const productForSeo = verifiedProductForSeo || initialProduct || publicProduct
  const categoryName = String(productForSeo?.prodCategoryName || publicProduct.prodCategoryName || '').trim()
  const categoryHref = categoryName ? absoluteUrl(`/customer/category?type=${encodeURIComponent(categoryName.toLowerCase())}`) : null
  const breadcrumbItems: any[] = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
    { '@type': 'ListItem', position: 2, name: 'Shop', item: absoluteUrl('/customer/shop') },
  ]
  if (categoryName && categoryHref) {
    breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: categoryName, item: categoryHref })
  }
  breadcrumbItems.push({ '@type': 'ListItem', position: breadcrumbItems.length + 1, name: String(publicProduct.prodName || 'Product'), item: canonical })

  const imageUrls = (initialImages.length > 0 ? initialImages : (publicProduct.prodImg ? [String(publicProduct.prodImg)] : [])).filter(Boolean)
  const productLd = buildProductSchema(productForSeo, canonical, initialSkus, initialSpecs, imageUrls, initialReviews)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: breadcrumbItems },
      productLd,
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ProductClient
        initialProduct={initialProduct}
        initialImages={initialImages}
        initialSpecs={initialSpecs}
        initialReviews={initialReviews}
        initialRelatedProducts={initialRelatedProducts}
        initialSkus={initialSkus ?? []}
        initialSkuId={searchParams.sku}
      />
    </>
  )
}
