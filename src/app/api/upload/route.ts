import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { requireAdmin } from '@/lib/apiMiddleware'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const handler = async (req: NextRequest, user: any) => {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const isPdf = file.type === 'application/pdf'

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

    return NextResponse.json({ url: (result as any).secure_url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const POST = requireAdmin(handler)
