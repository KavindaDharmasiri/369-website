import { getActiveDiscounts } from '@/lib/discounts'
import { publicProductSelect } from '@/lib/publicProduct'

/**
 * In-memory snapshot of the public catalogue for the suggestion engine.
 *
 * Selecting products used to run ~30 sequential database queries per suggestion,
 * which took ~10s against a remote database — long enough that shoppers left the
 * page before the answer arrived. The catalogue is small and changes rarely, so it
 * is loaded once (all queries in parallel) and refreshed in the background.
 */

const TTL_MS = 60_000
const MAX_PRODUCTS = 3000

export type CatalogProduct = Record<string, any> & {
  id: number
  categoryId: number
  subCategoryId: number
  prodName: string
  prodPrice: number
  stockStatus: boolean
}

export type Catalog = {
  loadedAt: number
  products: CatalogProduct[]
  byId: Map<number, CatalogProduct>
  categories: { id: number; name: string }[]
  discounts: any[]
  bestsellerIds: number[]
  mostWishedIds: number[]
}

type CacheState = { value: Catalog | null; loading: Promise<Catalog> | null }
const g = globalThis as unknown as { __suggestCatalog?: CacheState }
const state: CacheState = g.__suggestCatalog || (g.__suggestCatalog = { value: null, loading: null })

async function load(db: any): Promise<Catalog> {
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
  const [rows, categories, discounts, best, wished] = await Promise.all([
    db.product.findMany({
      where: {
        status: 'ACTIVE',
        prodMarket: { in: ['MARKETPLACE', 'BOTH'] },
        isDeleted: false,
        category: { isActive: true },
        subCategory: { isActive: true },
      },
      select: { ...publicProductSelect, tagsCategory: true, productImages: { orderBy: { isPrimary: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      take: MAX_PRODUCTS,
    }).catch(() => [] as any[]),
    db.category.findMany({ where: { isActive: true }, select: { id: true, name: true } }).catch(() => [] as any[]),
    getActiveDiscounts(db).catch(() => [] as any[]),
    db.orderItem.groupBy({
      by: ['productId'],
      where: { order: { createdAt: { gte: since } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 40,
    }).catch(() => [] as any[]),
    db.wishlistItem.groupBy({
      by: ['productId'],
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 40,
    }).catch(() => [] as any[]),
  ])
  const products: CatalogProduct[] = (rows as any[]).map(r => ({ ...r, prodPrice: Number(r.prodPrice) }))
  return {
    loadedAt: Date.now(),
    products,
    byId: new Map(products.map(p => [p.id, p])),
    categories: categories as any[],
    discounts: discounts as any[],
    bestsellerIds: (best as any[]).map(r => r.productId).filter(Number.isInteger),
    mostWishedIds: (wished as any[]).map(r => r.productId).filter(Number.isInteger),
  }
}

function refresh(db: any): Promise<Catalog> {
  if (!state.loading) {
    state.loading = load(db)
      .then(c => { state.value = c; return c })
      .finally(() => { state.loading = null })
  }
  return state.loading
}

/** Fresh snapshot when available; a stale one is served instantly while it refreshes. */
export async function getCatalog(db: any): Promise<Catalog> {
  const v = state.value
  if (v && Date.now() - v.loadedAt < TTL_MS) return v
  if (v) { void refresh(db).catch(() => {}); return v }
  return refresh(db)
}

/** For tests. */
export function resetCatalogCache() { state.value = null; state.loading = null }
