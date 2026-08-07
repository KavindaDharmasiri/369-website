import prisma from '@/lib/db'

export interface AppSettings {
  taxMode: string
  taxRate: number
  lowStockThreshold: number
  [key: string]: string | number
}

const DEFAULT_SETTINGS: Record<string, string> = {
  taxMode: 'percentage',
  taxRate: '8',
  lowStockThreshold: '10',
}

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await prisma.appSetting.findMany()
  const map: Record<string, string> = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    map[row.key] = row.value
  }
  return {
    taxMode: map.taxMode,
    taxRate: parseFloat(map.taxRate) || 0,
    lowStockThreshold: parseInt(map.lowStockThreshold) || 10,
  }
}

export async function setAppSetting(key: string, value: string, description?: string) {
  const existing = await prisma.appSetting.findUnique({ where: { key } })
  if (existing) {
    return prisma.appSetting.update({
      where: { key },
      data: { value, description: description ?? existing.description },
    })
  }
  return prisma.appSetting.create({
    data: { key, value, description },
  })
}
