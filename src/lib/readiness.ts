/** Bound HTTP latency and coalesce probes so a slow DB cannot create a probe storm.
 * The deadline does not cancel an already-running database-driver query. */
export function createReadinessProbe(query: () => Promise<unknown>, timeoutMs = 2000) {
  let inFlight: Promise<boolean> | null = null
  return async () => {
    if (!inFlight) {
      inFlight = Promise.resolve().then(query).then(() => true, () => false)
        .finally(() => { inFlight = null })
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([inFlight, new Promise<false>(resolve => {
        timer = setTimeout(() => resolve(false), timeoutMs)
      })])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
