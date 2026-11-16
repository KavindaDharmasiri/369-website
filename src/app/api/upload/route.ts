import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { requireAdmin } from '@/lib/apiMiddleware'
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rateLimit'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const handler = async (req: NextRequest, user: any) => {
  try {
    const rl = checkRateLimit(`upload:${user.userId}:${getClientIp(req)}`, 60, 60 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many uploads. Please try again later.' }, { status: 429, headers: rateLimitHeaders(rl) })
    }
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const isPdf = file.type === 'application/pdf'
    const isImage = file.type?.startsWith('image/')
    if (!isPdf && !isImage) {
      return NextResponse.json({ error: 'Only image or PDF files are allowed' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const MAX_BYTES = isPdf ? 20 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File is too large or invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          folder: 'products',
          resource_type: isPdf ? 'raw' : 'auto'
        }, 
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      ).end(buffer)
    })

    return NextResponse.json({ url: (result as any).secure_url }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export const POST = requireAdmin(handler)
