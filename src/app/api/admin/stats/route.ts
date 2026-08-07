import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'

async function handler(request: NextRequest, user: any) {
  try {
    const [totalRevenueAgg, totalOrders, totalUsers, totalProducts, topProductsAgg] = await Promise.all([
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { notIn: ['CANCELLED', 'REFUNDED'] } }
      }),
      prisma.order.count(),
      prisma.user.count(),
      prisma.product.count({ where: { status: 'ACTIVE', isDeleted: false } }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5
      })
    ])

    const productIds = topProductsAgg.map((t) => t.productId)
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, prodName: true, prodPrice: true, prodCategoryName: true, prodImg: true }
        })
      : []

    const topProducts = topProductsAgg
      .map((t) => {
        const product = products.find((p) => p.id === t.productId)
        return {
          productId: t.productId,
          name: product?.prodName || `Product #${t.productId}`,
          category: product?.prodCategoryName || '—',
          price: product ? Number(product.prodPrice) : 0,
          sold: t._sum.quantity || 0,
          revenue: t._sum.subtotal ? Number(t._sum.subtotal) : 0,
          img: product?.prodImg || null
        }
      })
      .sort((a, b) => b.sold - a.sold)

    const stats = {
      totalRevenue: Number(totalRevenueAgg._sum.total || 0),
      totalOrders,
      totalUsers,
      totalProducts,
      conversionRate: totalUsers > 0 ? Number(((totalOrders / totalUsers) * 100).toFixed(2)) : 0,
      topProducts
    }

    return NextResponse.json(stats)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

export const GET = requireAdmin(handler)
