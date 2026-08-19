import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { encrypt } from '@/lib/encryption'
import { requireAuth } from '@/lib/apiMiddleware'
import prisma from '@/lib/db'
import {
  ensureTryOnRecord,
  getPackageState,
  todayStr,
} from '@/lib/tryonSpace'

export const runtime = 'nodejs'
export const maxDuration = 60

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})


const REPLICATE_VERSION =
  process.env.TRYON_REPLICATE_VERSION || '0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985'
const REPLICATE_CATEGORY = process.env.TRYON_REPLICATE_CATEGORY || 'upper_body'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

async function runReplicateTryOn(
  personUrl: string,
  garmentUrl: string,
  garmentDescription: string
): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) {
    throw new Error('Try-on is not configured (REPLICATE_API_TOKEN missing). Contact the store admin.')
  }

  const res = await fetch(`https://api.replicate.com/v1/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: REPLICATE_VERSION,
      input: {
        human_img: personUrl,
        garm_img: garmentUrl,
        garment_des: garmentDescription,
        category: REPLICATE_CATEGORY,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message = body?.error || body?.detail || `Try-on request failed (${res.status})`
    throw new Error(message)
  }

  const prediction = await res.json()
  const id = prediction.id
  const deadline = Date.now() + 50000

  while (Date.now() < deadline) {
    await sleep(2000)
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const p = await poll.json()
    if (p.status === 'succeeded') {
      const out = p.output
      const url = typeof out === 'string' ? out : Array.isArray(out) ? out[0] : undefined
      if (url) return url
      throw new Error('Try-on produced no output image')
    }
    if (p.status === 'failed') {
      throw new Error(p.error || 'Try-on failed')
    }
  }

  throw new Error('Try-on is taking too long. Please try again.')
}

export const POST = requireAuth(async (request: NextRequest, user: any) => {
  try {
    const formData = await request.formData()
    const personFile = formData.get('personImage') as File | null
    const garmentUrl = String(formData.get('garmentUrl') || '')
    const garmentDescription = String(formData.get('garmentDescription') || '')

    if (!personFile || !garmentUrl) {
      return NextResponse.json({ error: 'Person image and garment image are required' }, { status: 400 })
    }

    let record = await ensureTryOnRecord(user.userId)

    const today = todayStr()
    let usedToday = record.usedToday
    if (record.usageDate !== today) {
      usedToday = 0
      await prisma.tryOnSpace.update({
        where: { userId: user.userId },
        data: { usedToday: 0, usageDate: today },
      })
    }

    const pkg = getPackageState(record)
    if (!pkg.active) {
      return NextResponse.json(
        {
          error: 'The free instant preview runs entirely on your device. Upgrade to the package for photorealistic results.',
          payToContinue: true,
          remaining: 0,
        },
        { status: 402 }
      )
    }

    if (usedToday >= pkg.dailyLimit) {
      return NextResponse.json(
        { error: `Daily try-on limit reached (${pkg.dailyLimit}/day). Try again tomorrow.`, remaining: 0 },
        { status: 429 }
      )
    }

    const personBuffer = Buffer.from(await personFile.arrayBuffer())
    const personUrl = await uploadToCloudinary(personBuffer, 'tryon-uploads')
    const resultUrl = await runReplicateTryOn(personUrl, garmentUrl, garmentDescription)

    const imageRes = await fetch(resultUrl)
    if (!imageRes.ok) {
      return NextResponse.json({ error: 'Failed to download try-on result' }, { status: 502 })
    }
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

    const uploadedUrl = await uploadToCloudinary(imageBuffer, 'tryon')

    await prisma.tryOnSpace.update({
      where: { userId: user.userId },
      data: { usedToday: { increment: 1 }, usageDate: today },
    })

    return NextResponse.json({
      data: encrypt(
        JSON.stringify({
          url: uploadedUrl,
          remaining: pkg.dailyLimit - usedToday - 1,
          free: false,
        })
      ),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Try-on failed' }, { status: 500 })
  }
})
