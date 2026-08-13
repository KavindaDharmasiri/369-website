export function createInferenceWorker(): Worker {
  return new Worker(
    new URL('../../node_modules/@practics/tryon-core/dist/workers/inference.worker.js', import.meta.url),
    { type: 'module' }
  )
}
