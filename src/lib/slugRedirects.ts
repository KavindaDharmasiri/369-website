import prisma from '@/lib/db'

export type SlugRedirectRecord = {
  fromPath: string
  toPath: string
  statusCode: number
}

function isMissingRedirectStore(error: any) {
  return error?.code === 'P2021' || error?.code === 'P2022' || /slugRedirect|slug_redirects|Unknown arg|does not exist|findFirst|upsert|updateMany|create/i.test(error?.message || '')
}

export async function resolveSlugRedirect(pathnameWithSearch: string): Promise<SlugRedirectRecord | null> {
  try {
    const model = (prisma as any).slugRedirect
    if (!model?.findFirst) return null
    const redirect = await model.findFirst({
      where: { fromPath: pathnameWithSearch, isActive: true },
      select: { fromPath: true, toPath: true, statusCode: true },
    })
    if (!redirect) return null
    const statusCode = redirect.statusCode === 308 ? 308 : 301
    return { fromPath: redirect.fromPath, toPath: redirect.toPath, statusCode }
  } catch (error: any) {
    // Migration/client/model may not be ready yet.
    if (isMissingRedirectStore(error)) {
      return null
    }
    throw error
  }
}

export async function recordSlugRedirect(params: {
  entityType: string
  entityId?: number | null
  fromPath: string
  toPath: string
  statusCode?: 301 | 308
}) {
  const { entityType, entityId = null, fromPath, toPath } = params
  const statusCode = params.statusCode === 308 ? 308 : 301
  if (!fromPath || !toPath || fromPath === toPath) return { recorded: false, reason: 'noop' as const }

  try {
    const model = (prisma as any).slugRedirect
    if (!model?.upsert || !model?.updateMany) return { recorded: false, reason: 'unavailable' as const }

    await model.upsert({
      where: { fromPath },
      update: { entityType, entityId, toPath, statusCode, isActive: true },
      create: { entityType, entityId, fromPath, toPath, statusCode, isActive: true },
    })

    // Prevent simple redirect chains by retargeting existing redirects that pointed to the old path.
    await model.updateMany({
      where: { toPath: fromPath, NOT: { fromPath: toPath } },
      data: { toPath, statusCode, isActive: true },
    })

    return { recorded: true as const }
  } catch (error: any) {
    if (isMissingRedirectStore(error)) {
      return { recorded: false, reason: 'unavailable' as const }
    }
    throw error
  }
}
