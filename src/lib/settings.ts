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
    taxRate: settingNumber(map.taxRate, 8),
    lowStockThreshold: settingNumber(map.lowStockThreshold, 10, true),
  }
}

export function settingNumber(value: string | undefined, fallback: number, integer = false): number {
  if (value === undefined || !value.trim()) return fallback
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && (!integer || Number.isInteger(number)) ? number : fallback
}

export function setAppSetting(key: string, value: string, description?: string) {
  return prisma.appSetting.upsert({
    where: { key },
    update: { value, ...(description !== undefined ? { description } : {}) },
    create: { key, value, description },
  })
}
