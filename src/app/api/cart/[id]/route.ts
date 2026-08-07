import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    await prisma.cartItem.delete({
      where: { 
        id: parseInt(params.id),
        userId: decoded.userId 
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete cart item error:', error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    const { quantity } = await request.json()

    const cartItem = await prisma.cartItem.update({
      where: { 
        id: parseInt(params.id),
        userId: decoded.userId 
      },
      data: { quantity }
    })

    return NextResponse.json({ success: true, data: cartItem })
  } catch (error) {
    console.error('Update cart item error:', error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}
