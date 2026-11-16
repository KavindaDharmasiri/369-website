import type { NextRequest } from 'next/server'
import prisma from '@/lib/db'

type AuditInput = {
  userId: number
  userEmail: string
  action: string
  entityType: string
  entityId?: string | number | null
  metadata?: unknown
  request?: NextRequest
}

export async function recordAudit(input: AuditInput) {
  try {
    const ipAddress = input.request?.headers.get('x-forwarded-for') || input.request?.headers.get('x-real-ip') || 'unknown'
    const userAgent = input.request?.headers.get('user-agent') || 'unknown'
    await prisma.auditTrail.create({
      data: {
        userId: input.userId,
        userEmail: input.userEmail,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId == null ? null : String(input.entityId),
        metadata: input.metadata == null ? null : JSON.stringify(input.metadata),
        ipAddress,
        userAgent,
      },
    })
  } catch (error) {
    // Best-effort: do not fail business mutations when audit persistence is unavailable.
    logServerError('Audit log write failed', error)
  }
}
import { logServerError } from './serverLog'
