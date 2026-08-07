import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { computeTax } from '@/lib/pricing'
import { getAppSettings } from '@/lib/settings'
import { createNotification, notifyLowStock } from '@/lib/notify'
import { validateCoupon } from '@/lib/coupons'
import { getActiveDiscounts, bestDiscountForProduct, computeSalePrice } from '@/lib/discounts'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    const { 
      email, firstName, lastName, address, apartment, city, state, zipCode, phone,
      paymentMethod, items, couponCode
    } = await request.json()

    // Validate required fields
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items in order' }, { status: 400 })
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Create order with complete transaction rollback on any failure
    const result = await prisma.$transaction(async (tx) => {
      // Re-derive prices and validate stock server-side (never trust client totals)
      let subtotal = 0
      let productDiscount = 0
      const resolvedItems = []
      const discounts = await getActiveDiscounts(tx)

      for (const item of items) {
        let price = 0
        let product: any = null

        if (item.skuId) {
          const sku = await tx.productSku.findUnique({
            where: { id: item.skuId },
            select: { id: true, price: true, stock: true, isActive: true, productId: true }
          })

          if (!sku || !sku.isActive) {
            throw new Error(`Product SKU ${item.skuId} not found or inactive`)
          }
          if (sku.stock < item.quantity) {
            throw new Error(`Insufficient stock for SKU ${item.skuId}. Available: ${sku.stock}, Requested: ${item.quantity}`)
          }
          if (sku.productId !== item.productId) {
            throw new Error(`SKU ${item.skuId} does not belong to product ${item.productId}`)
          }

          product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true, prodPrice: true, status: true, isDeleted: true, categoryId: true, subCategoryId: true }
          })
          if (!product || product.isDeleted || product.status !== 'ACTIVE') {
            throw new Error(`Product ${item.productId} not found or inactive`)
          }

          price = Number(sku.price)
        } else {
          const productRecord = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true, prodPrice: true, status: true, isDeleted: true, categoryId: true, subCategoryId: true }
          })

          if (!productRecord || productRecord.isDeleted || productRecord.status !== 'ACTIVE') {
            throw new Error(`Product ${item.productId} not found or inactive`)
          }

          product = productRecord
          price = Number(productRecord.prodPrice)
        }

        const best = bestDiscountForProduct(discounts, product)
        const salePrice = best ? computeSalePrice(price, best) : price
        const originalPrice = price

        const lineSubtotal = salePrice * item.quantity
        subtotal += lineSubtotal
        productDiscount += (originalPrice - salePrice) * item.quantity
        resolvedItems.push({ ...item, price: salePrice, originalPrice, subtotal: lineSubtotal })
      }

      // Shipping fee (server-side, from active shipping fee)
      const activeShipping = await tx.shippingFee.findFirst({ where: { isActive: true } })
      let shippingFee = activeShipping ? Number(activeShipping.value) : 0
      if (activeShipping && activeShipping.type.toLowerCase() === 'percentage') {
        shippingFee = (subtotal * Number(activeShipping.value)) / 100
      }

      // Tax, from admin-configured settings
      const settings = await tx.appSetting.findMany()
      const settingMap: Record<string, string> = {}
      for (const s of settings) settingMap[s.key] = s.value
      const taxMode = settingMap.taxMode || 'percentage'
      const taxRate = parseFloat(settingMap.taxRate) || 8
      const tax = computeTax(taxMode, taxRate, subtotal)

      // Coupon discount (server-side validation, never trust client totals)
      let discount = 0
      let appliedCoupon: any = null
      if (couponCode) {
        const couponResult = await validateCoupon(tx, couponCode, subtotal)
        if (!couponResult.valid) {
          throw new Error(couponResult.message || 'Invalid coupon code')
        }
        discount = couponResult.discount || 0
        appliedCoupon = couponResult.coupon
      }

      const total = subtotal - discount + shippingFee + tax

      // Create the order
      const newOrder = await tx.order.create({
        data: {
          userId: decoded.userId,
          orderNumber,
          email,
          firstName,
          lastName,
          address,
          apartment,
          city,
          state,
          zipCode,
          phone,
          subtotal,
          shippingFee,
          tax,
          discount,
          productDiscount: Math.round(productDiscount * 100) / 100,
          couponCode: appliedCoupon ? appliedCoupon.code : null,
          couponId: appliedCoupon ? appliedCoupon.id : null,
          total,
          paymentMethod,
          status: 'PENDING'
        }
      })

      // Increment coupon usage count
      if (appliedCoupon) {
        await tx.coupon.update({
          where: { id: appliedCoupon.id },
          data: { usedCount: { increment: 1 } }
        })
      }

      // Create order items and update stock atomically
      for (const item of resolvedItems) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            skuId: item.skuId,
            productName: item.name,
            specs: item.specs ? JSON.stringify(item.specs) : null,
            price: item.price,
            originalPrice: item.originalPrice,
            quantity: item.quantity,
            subtotal: item.subtotal
          }
        })

        // Update stock if SKU exists
        if (item.skuId) {
          await tx.productSku.update({
            where: { id: item.skuId },
            data: { stock: { decrement: item.quantity } }
          })
        }
      }

      // Clear user's cart
      await tx.cartItem.deleteMany({
        where: { userId: decoded.userId }
      })

      return newOrder
    })

    await Promise.all([
      createNotification({
        type: 'ORDER_PLACED',
        title: 'New Order',
        message: `Order ${result.orderNumber} for LKR ${Number(result.total).toFixed(2)} has been placed.`,
        entityId: String(result.id),
      }).catch(() => null),
      notifyLowStock().catch(() => null),
    ])

    return NextResponse.json({ 
      success: true, 
      data: { 
        orderNumber: result.orderNumber,
        orderId: result.id,
        status: result.status
      } 
    })
    
  } catch (error) {
    console.error('Create order error:', error)
    
    // Return specific error messages for better debugging
    if (error instanceof Error) {
      if (error.message.includes('Insufficient stock')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (
        error.message.includes('coupon') ||
        error.message.includes('Coupon') ||
        error.message.includes('expired') ||
        error.message.includes('Minimum order')
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
    
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    
    // Admin can see all orders, customers see only their orders
    const orders = await prisma.order.findMany({
      where: decoded.userType === 'admin' ? {} : { userId: decoded.userId },
      include: { orderItems: true },
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    return NextResponse.json({ success: true, data: { orders } })
  } catch (error) {
    console.error('Get orders error:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
