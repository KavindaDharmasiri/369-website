// Keep stock separate from publication: a temporarily sold-out product is still
// useful public content, not a permanently missing page.
export function isPublicProduct(product: any): boolean {
  return !!product && product.status === 'ACTIVE' &&
    ['MARKETPLACE', 'BOTH'].includes(product.prodMarket) && !product.isDeleted &&
    product.category?.isActive === true &&
    (!product.subCategoryId || product.subCategory?.isActive === true)
}

// Explicit rollout-safe selects avoid implicitly reading unapplied slug columns
// on products AND on their category relations. Add slug URLs only at cutover.
export const publicProductSelect = {
  id: true, status: true, stockStatus: true, prodMarket: true, prodType: true,
  prodCategoryName: true, prodSubCategoryName: true, prodName: true, prodSubtitle: true,
  prodDescription: true, prodImg: true, prodPrice: true, chargeTax: true,
  featuredOnHomepage: true, showInNewArrivals: true, returnPolicyDoc: true,
  categoryId: true, subCategoryId: true, baseSku: true, isDeleted: true,
  createdAt: true, updatedAt: true,
  category: { select: { id: true, name: true, isActive: true } },
  subCategory: { select: { id: true, name: true, categoryId: true, isActive: true } },
} as const

export async function findPublicProduct(db: any, identifier?: string, select: Record<string, unknown> = publicProductSelect) {
  if (!identifier) return null
  if (/^[1-9]\d*$/.test(identifier)) {
    const id = Number(identifier)
    if (!Number.isSafeInteger(id) || id > 2147483647) return null
    return db.product.findUnique({ where: { id }, select })
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identifier) || identifier.length > 200) return null
  try {
    return await db.product.findFirst({ where: { slug: identifier }, select })
  } catch (error: any) {
    // Slug URLs are unavailable on a pre-migration database. Other errors must
    // reach the error boundary, never be mislabeled as a permanent missing URL.
    if (error?.code === 'P2022' && /slug/i.test(String(error?.meta?.column || error?.message || ''))) return null
    throw error
  }
}
