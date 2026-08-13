/**
 * Sets up the static assets for the on-device (WebGPU) free try-on tier:
 *  1. Copies the LiteRT.js wasm runtime out of node_modules into
 *     public/litert-wasm/ (gitignored — ~75MB, too big to commit).
 *  2. Downloads the two .tflite models into public/models/ (kept in git —
 *     small and required at runtime).
 * Runs on postinstall so both Vercel builds and local dev have the assets.
 */
import { cp, mkdir, writeFile, access, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const MODELS = [
  {
    file: 'selfie_segmenter.tflite',
    url: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
  },
  {
    file: 'movenet_singlepose_lightning.tflite',
    url: 'https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/float16/4?lite-format=tflite',
  },
]

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function copyWasm() {
  const src = path.join(root, 'node_modules', '@litertjs', 'core', 'wasm')
  const dest = path.join(root, 'public', 'litert-wasm')
  if (!(await exists(src))) {
    console.warn('[setup-tryon-assets] @litertjs/core wasm runtime not found; skipping')
    return
  }
  await rm(dest, { recursive: true, force: true })
  await mkdir(dest, { recursive: true })
  await cp(src, dest, { recursive: true })
  console.log('[setup-tryon-assets] copied LiteRT wasm runtime -> public/litert-wasm/')
}

async function fetchModels() {
  const outDir = path.join(root, 'public', 'models')
  await mkdir(outDir, { recursive: true })
  for (const { file, url } of MODELS) {
    const dest = path.join(outDir, file)
    if (await exists(dest)) {
      console.log(`[setup-tryon-assets] skip ${file} (exists)`)
      continue
    }
    process.stdout.write(`[setup-tryon-assets] fetching ${file} ... `)
    try {
      const res = await fetch(url, { redirect: 'follow' })
      if (!res.ok) {
        console.error(`FAILED: ${res.status} ${res.statusText}`)
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      await writeFile(dest, buf)
      console.log(`${(buf.length / 1024).toFixed(0)} KB`)
    } catch (err) {
      console.error(`FAILED: ${err.message}`)
    }
  }
}

await copyWasm()
await fetchModels()
