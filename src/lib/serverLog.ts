import { randomUUID } from 'node:crypto'

// Allowlist, do not recursively serialize errors: Prisma/provider errors can
// contain SQL, delivery addresses, credentials, photo URLs or response bodies.
export function serverErrorRecord(event: string, error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  const name = error instanceof Error ? error.name : 'Error'
  return {
    level: 'error',
    event: /^[A-Za-z0-9 .:_-]{1,100}$/.test(event) ? event : 'server.error',
    incidentId: randomUUID(),
    errorType: /^(Error|TypeError|RangeError|ValidationError|AbortError|PrismaClient[A-Za-z]+Error)$/.test(name) ? name : 'Error',
    ...(/^(P\d{4}|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE)$/.test(code) ? { code } : {}),
  }
}

export function logServerError(event: string, error: unknown) {
  const record = serverErrorRecord(event, error)
  console.error(JSON.stringify(record))
  return record.incidentId
}
