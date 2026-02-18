import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    console.log('=== Audit API Called ===')
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    console.log('Token exists:', !!token)
    
    if (!token) {
      console.log('No token, returning success')
      return NextResponse.json({ success: true })
    }

    const user = verifyToken(token)
    console.log('User verified:', user ? `ID: ${user.userId}, Type: ${user.userType}` : 'null')
    if (!user || user.userType !== 'customer') {
      console.log('Not customer, returning success')
      return NextResponse.json({ success: true })
    }

    const body = await req.json()
    console.log('Request body:', body)
    const { action, entityType, entityId, metadata } = body

    console.log('Creating audit trail...')
    await prisma.auditTrail.create({
      data: {
        userId: user.userId,
        userEmail: user.email,
        action,
        entityType,
        entityId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown'
      }
    })
    console.log('Audit trail created successfully')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('=== Audit Error ===')
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    return NextResponse.json({ success: true })
  }
}
