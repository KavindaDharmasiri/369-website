import prisma from '@/lib/db'

export const TRYON_DAILY_LIMIT = Math.max(1, parseInt(process.env.TRYON_DAILY_LIMIT || '3', 10))
export const TRYON_PACKAGE_PRICE = parseFloat(process.env.TRYON_PACKAGE_PRICE || '4.99')
export const TRYON_PACKAGE_DAILY_LIMIT = Math.max(1, parseInt(process.env.TRYON_PACKAGE_DAILY_LIMIT || '20', 10))
export const TRYON_PACKAGE_DAYS = Math.max(1, parseInt(process.env.TRYON_PACKAGE_DAYS || '30', 10))
export const TRYON_COMMISSION_PERCENT = Math.max(0, parseFloat(process.env.TRYON_COMMISSION_PERCENT || '10'))

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function ensureTryOnRecord(userId: number) {
  return prisma.tryOnSpace.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
}

export function getPackageState(record: {
  packageStatus: string
  packageExpiresAt: Date | string | null
  packageDailyLimit: number
}) {
  const now = new Date()
  const expiresAt = record.packageExpiresAt ? new Date(record.packageExpiresAt) : null
  const active =
    record.packageStatus === 'active' && !!expiresAt && expiresAt.getTime() > now.getTime()
  return {
    active,
    dailyLimit: active && record.packageDailyLimit > 0 ? record.packageDailyLimit : TRYON_DAILY_LIMIT,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  }
}
