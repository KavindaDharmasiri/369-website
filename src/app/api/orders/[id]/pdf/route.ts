import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || request.cookies.get('authToken')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    const orderId = parseInt(params.id)

    const order = await prisma.order.findFirst({
      where: decoded.userType === 'admin'
        ? { id: orderId }
        : { id: orderId, userId: decoded.userId },
      include: { 
        orderItems: true 
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Header - Brand
    page.drawText('369', { x: 50, y: 792, size: 36, font: boldFont, color: rgb(0, 0, 0) })
    page.drawText('Everyday quiet luxury for the modern wardrobe', { x: 50, y: 768, size: 8, font, color: rgb(0.5, 0.5, 0.5) })
    
    // Invoice Title
    page.drawText('INVOICE', { x: 460, y: 792, size: 22, font: boldFont })
    page.drawText(`#${order.orderNumber}`, { x: 460, y: 772, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
    
    // Divider line
    page.drawLine({ start: { x: 40, y: 750 }, end: { x: 555, y: 750 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
    
    // Order Info - Clean layout
    page.drawText('Order Date:', { x: 50, y: 720, size: 9, font: boldFont })
    page.drawText(new Date(order.createdAt).toLocaleDateString(), { x: 50, y: 705, size: 10, font })
    
    page.drawText('Status:', { x: 200, y: 720, size: 9, font: boldFont })
    const statusKey = order.status.toUpperCase()
    const statusColor = statusKey === 'DELIVERED' ? rgb(0.15, 0.68, 0.38) : statusKey === 'PENDING' ? rgb(0.2, 0.6, 0.86) : statusKey === 'CANCELLED' || statusKey === 'REFUNDED' ? rgb(0.8, 0.2, 0.2) : rgb(0.95, 0.61, 0.07)
    page.drawText(order.status.toUpperCase(), { x: 200, y: 705, size: 10, font: boldFont, color: statusColor })
    
    page.drawText('Payment:', { x: 350, y: 720, size: 9, font: boldFont })
    page.drawText(order.paymentMethod, { x: 350, y: 705, size: 10, font })
    
    // Customer Info
    page.drawText('BILL TO', { x: 50, y: 665, size: 10, font: boldFont })
    page.drawText(`${order.firstName} ${order.lastName}`, { x: 50, y: 648, size: 10, font })
    page.drawText(order.address, { x: 50, y: 633, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
    if (order.apartment) page.drawText(order.apartment, { x: 50, y: 620, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
    const cityLine = order.apartment ? 607 : 620
    page.drawText(`${order.city}, ${order.state} ${order.zipCode}`, { x: 50, y: cityLine, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
    page.drawText(order.phone, { x: 50, y: cityLine - 13, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
    page.drawText(order.email, { x: 50, y: cityLine - 26, size: 9, font, color: rgb(0.3, 0.3, 0.3) })

    // Items Table Header
    const tableTop = 540
    page.drawRectangle({ x: 40, y: tableTop - 2, width: 515, height: 22, color: rgb(0.97, 0.97, 0.97) })
    page.drawText('PRODUCT', { x: 50, y: tableTop + 5, size: 9, font: boldFont })
    page.drawText('QTY', { x: 380, y: tableTop + 5, size: 9, font: boldFont })
    page.drawText('PRICE', { x: 430, y: tableTop + 5, size: 9, font: boldFont })
    page.drawText('TOTAL', { x: 500, y: tableTop + 5, size: 9, font: boldFont })
    
    // Items
    let yPosition = tableTop - 18
    order.orderItems.forEach((item: any, index: number) => {
      const productName = item.productName.length > 45 ? item.productName.substring(0, 45) + '...' : item.productName
      page.drawText(productName, { x: 50, y: yPosition, size: 9, font })
      page.drawText(item.quantity.toString(), { x: 390, y: yPosition, size: 9, font })
      page.drawText(`LKR ${Number(item.price).toFixed(2)}`, { x: 430, y: yPosition, size: 9, font })
      page.drawText(`LKR ${Number(item.subtotal).toFixed(2)}`, { x: 485, y: yPosition, size: 9, font })
      yPosition -= 22
    })

    // Totals Section
    yPosition -= 15
    page.drawLine({ start: { x: 400, y: yPosition + 10 }, end: { x: 555, y: yPosition + 10 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
    page.drawText('Subtotal:', { x: 430, y: yPosition - 5, size: 9, font })
    page.drawText(`LKR ${Number(order.subtotal).toFixed(2)}`, { x: 485, y: yPosition - 5, size: 9, font })
    page.drawText('Shipping:', { x: 430, y: yPosition - 20, size: 9, font })
    page.drawText(`LKR ${Number(order.shippingFee).toFixed(2)}`, { x: 485, y: yPosition - 20, size: 9, font })
    page.drawText('Tax:', { x: 430, y: yPosition - 35, size: 9, font })
    page.drawText(`LKR ${Number(order.tax).toFixed(2)}`, { x: 485, y: yPosition - 35, size: 9, font })
    
    page.drawLine({ start: { x: 400, y: yPosition - 45 }, end: { x: 555, y: yPosition - 45 }, thickness: 1.5, color: rgb(0, 0, 0) })
    page.drawText('TOTAL:', { x: 430, y: yPosition - 62, size: 11, font: boldFont })
    page.drawText(`LKR ${Number(order.total).toFixed(2)}`, { x: 475, y: yPosition - 62, size: 11, font: boldFont })

    // Status Stamp - More subtle
    const stampY = yPosition - 110
    page.drawCircle({ x: 100, y: stampY, size: 45, borderColor: statusColor, borderWidth: 2.5, opacity: 0.25 })
    page.drawCircle({ x: 100, y: stampY, size: 38, borderColor: statusColor, borderWidth: 1.5, opacity: 0.25 })
    const statusText = order.status.toUpperCase()
    const textWidth = statusText.length * 4
    page.drawText(statusText, { x: 100 - textWidth, y: stampY - 4, size: 10, font: boldFont, color: statusColor, opacity: 0.4 })

    // Footer
    page.drawLine({ start: { x: 40, y: 70 }, end: { x: 555, y: 70 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) })
    page.drawText('369 - Everyday quiet luxury for the modern wardrobe', { x: 50, y: 52, size: 7, font, color: rgb(0.5, 0.5, 0.5) })
    page.drawText('This is a computer-generated invoice and is valid without signature', { x: 50, y: 40, size: 7, font, color: rgb(0.6, 0.6, 0.6) })
    page.drawText(`Generated on ${new Date().toLocaleString()}`, { x: 390, y: 52, size: 7, font, color: rgb(0.6, 0.6, 0.6) })

    const pdfBytes = await pdfDoc.save()
    
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="369-invoice-${order.orderNumber}.pdf"`
      }
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}