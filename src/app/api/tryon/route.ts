import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { requireAuth } from '@/lib/apiMiddleware'
import { Client } from '@gradio/client'
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 180

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const HF_SPACE = process.env.TRYON_SPACE || 'yisol/IDM-VTON'
const HF_TOKEN = process.env.HF_TOKEN || ''

function uploadToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) reject(error)
        else if (result) resolve(result.secure_url)
        else reject(new Error('Cloudinary upload returned no result'))
      }
    ).end(buffer)
  })
}

const MAX_ATTEMPTS = 3
const RETRYABLE = /session not found|connection closed|disconnect|fetch failed|network|timed? ?out|502|503/i

async function tryOnce(
  personUrl: string,
  garmentUrl: string,
  garmentDescription: string
): Promise<string> {
  const client = await Client.connect(HF_SPACE, { hf_token: HF_TOKEN as `hf_${string}` })

  const result = await client.predict('/tryon', {
    dict: {
      background: { url: personUrl, path: personUrl, meta: { _type: 'gradio.FileData' } },
      layers: [],
      composite: null,
    },
    garm_img: { url: garmentUrl, path: garmentUrl, meta: { _type: 'gradio.FileData' } },
    garment_des: garmentDescription,
    is_checked: true,
    is_checked_crop: false,
    denoise_steps: 30,
    seed: 42,
  })

  const data = (result.data ?? []) as unknown[]
  if (!data || data.length === 0) {
    throw new Error('Try-on produced no output')
  }

  const output = data[0]
  if (typeof output === 'string') return output
  if (output && typeof output === 'object' && 'url' in output) {
    return (output as { url: string }).url
  }
  if (output && typeof output === 'object' && 'path' in output) {
    return (output as { path: string }).path
  }
  throw new Error('Try-on produced an unexpected output format')
}

async function runHFTryOn(
  personUrl: string,
  garmentUrl: string,
  garmentDescription: string
): Promise<string> {
  if (!HF_TOKEN) {
    throw new Error('Try-on is not configured (HF_TOKEN missing). Contact the store admin.')
  }

  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await tryOnce(personUrl, garmentUrl, garmentDescription)
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      // The free space sleeps/restarts under load and kills sessions mid-request;
      // a fresh connection usually succeeds on retry.
      if (attempt === MAX_ATTEMPTS || !RETRYABLE.test(message)) throw error
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000))
    }
  }
  throw lastError
}

export const POST = requireAuth(async (request: NextRequest, user: any) => {
  try {
    const rl = checkRateLimit(`tryon:${user.userId}:${getClientIp(request)}`, 10, 60 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many try-on requests. Please try again later.' }, { status: 429, headers: rateLimitHeaders(rl) })
    }
    const formData = await request.formData()
    const personFile = formData.get('personImage') as File | null
    const garmentUrl = String(formData.get('garmentUrl') || '')
    const garmentDescription = String(formData.get('garmentDescription') || '')

    if (!personFile || !garmentUrl) {
      return NextResponse.json({ error: 'Person image and garment image are required' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }
    if (!/^https:\/\//i.test(garmentUrl)) {
      return NextResponse.json({ error: 'Invalid garment image URL' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const MAX_PERSON_IMAGE_BYTES = 10 * 1024 * 1024
    if (!personFile.type?.startsWith('image/')) {
      return NextResponse.json({ error: 'Person image must be a valid image file' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }
    if (personFile.size <= 0 || personFile.size > MAX_PERSON_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Person image is too large or invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const personBuffer = Buffer.from(await personFile.arrayBuffer())
    const personUrl = await uploadToCloudinary(personBuffer, 'tryon-uploads')

    let resultUrl = await runHFTryOn(personUrl, garmentUrl, garmentDescription)

    if (resultUrl.startsWith('/')) {
      resultUrl = `https://${HF_SPACE.replace('/', '-').toLowerCase()}.hf.space${resultUrl}`
    }

    const imageRes = await fetch(resultUrl)
    if (!imageRes.ok) {
      return NextResponse.json({ error: 'Failed to download try-on result' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer())
    const uploadedUrl = await uploadToCloudinary(imageBuffer, 'tryon')

    return NextResponse.json({ url: uploadedUrl }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Try-on failed' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
})
