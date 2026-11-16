type VisibilitySource = Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>

/** One active request; pause/abort while hidden; retry with bounded jittered backoff. */
export function startVisibilityPolling(task: (signal: AbortSignal) => Promise<unknown>, options: {
  document: VisibilitySource
  intervalMs?: number
  maxBackoffMs?: number
  random?: () => number
  schedule?: typeof setTimeout
  cancel?: typeof clearTimeout
}) {
  const { document: source, intervalMs = 20000, maxBackoffMs = 120000,
    random = Math.random, schedule = setTimeout, cancel = clearTimeout } = options
  let stopped = false
  let running = false
  let failures = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  const clear = () => { if (timer !== undefined) cancel(timer); timer = undefined }
  const tick = () => {
    clear()
    if (stopped || source.hidden || running) return
    running = true
    controller = new AbortController()
    const signal = controller.signal
    void Promise.resolve().then(() => task(signal)).then(
      () => { failures = 0 },
      () => { if (!signal.aborted) failures = Math.min(failures + 1, 8) },
    ).finally(() => {
      running = false
      if (stopped || source.hidden) return
      const delay = Math.min(maxBackoffMs, intervalMs * (2 ** failures))
      timer = schedule(tick, Math.round(delay * (0.9 + 0.1 * random())))
    })
  }
  const visibility = () => {
    if (source.hidden) { clear(); controller?.abort() }
    else tick()
  }
  source.addEventListener('visibilitychange', visibility)
  tick()
  return () => {
    stopped = true
    clear()
    controller?.abort()
    source.removeEventListener('visibilitychange', visibility)
  }
}
