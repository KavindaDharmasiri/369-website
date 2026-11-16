type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

function now() {
  return Date.now()
}

export function getClientIp(request: Request): string {
  const xf = request.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0].trim() || 'unknown'
  return request.headers.get('x-real-ip') || 'unknown'
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const t = now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= t) {
    const next = { count: 1, resetAt: t + windowMs }
    buckets.set(key, next)
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - t) / 1000)),
    }
  }

  existing.count += 1
  buckets.set(key, existing)
  return { allowed: true, remaining: Math.max(0, limit - existing.count), retryAfterSeconds: 0 }
}

export function rateLimitHeaders(result: { remaining: number; retryAfterSeconds: number }) {
  const headers: Record<string, string> = { 'Cache-Control': 'private, no-store' }
  if (result.retryAfterSeconds > 0) headers['Retry-After'] = String(result.retryAfterSeconds)
  return headers
}
