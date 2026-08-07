import prisma from '@/lib/db'

interface NotificationInput {
  type: string
  title: string
  message: string
  recipient?: string
  entityId?: string
}

export async function createNotification({ type, title, message, recipient = 'admin', entityId }: NotificationInput) {
  return prisma.notification.create({
    data: { type, title, message, recipient, entityId },
  })
}

export async function notifyLowStock() {
  const thresholdRow = await prisma.appSetting.findUnique({ where: { key: 'lowStockThreshold' } })
  const threshold = thresholdRow ? parseInt(thresholdRow.value) || 10 : 10

  const lowSkus = await prisma.productSku.findMany({
    where: { isActive: true, stock: { lte: threshold } },
    select: {
      id: true,
      skuCode: true,
      stock: true,
      productId: true,
      product: { select: { prodName: true, id: true } },
    },
  })

  for (const sku of lowSkus) {
    const exists = await prisma.notification.findFirst({
      where: { type: 'LOW_STOCK', entityId: String(sku.id), isRead: false },
    })
    if (exists) continue
    await createNotification({
      type: 'LOW_STOCK',
      title: 'Low Stock Alert',
      message: `${sku.product.prodName} (${sku.skuCode}) has only ${sku.stock} left.`,
      entityId: String(sku.id),
    })
  }

  return lowSkus.length
}
