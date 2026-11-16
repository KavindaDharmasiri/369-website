import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const IMG = 'https://res.cloudinary.com/do2otr6cu/image/upload/v1771230064/img_h8ghcn.png'

async function main() {
  const isProduction = process.env.NODE_ENV === 'production'
  const allowDemoSeed = process.env.SEED_DEMO_DATA === 'true'
  const seedDemoData = !isProduction || allowDemoSeed

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD

  let admin: { id: number; email: string } | null = null
  if (adminEmail && adminPassword) {
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10)
    admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { password: hashedAdminPassword, userType: 'admin', isActive: true },
      create: {
        email: adminEmail,
        password: hashedAdminPassword,
        userType: 'admin',
        isActive: true,
      },
      select: { id: true, email: true },
    })
    console.log('Seeded bootstrap admin account from environment variables.')
  } else {
    console.log('Skipped admin bootstrap: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create an admin account.')
  }

  if (!seedDemoData) {
    console.log('Skipped demo catalog/customer/order data. Set SEED_DEMO_DATA=true to seed demo data intentionally.')
    return
  }

  const demoCustomerEmail = process.env.SEED_DEMO_CUSTOMER_EMAIL?.trim() || 'customer@example.com'
  const demoCustomerPassword = process.env.SEED_DEMO_CUSTOMER_PASSWORD || 'Customer@123'
  const customerPassword = await bcrypt.hash(demoCustomerPassword, 10)

  const customer = await prisma.user.upsert({
    where: { email: demoCustomerEmail },
    update: {},
    create: {
      email: demoCustomerEmail,
      password: customerPassword,
      userType: 'customer',
      isActive: true,
    },
    select: { id: true, email: true },
  })

  const women = await prisma.category.upsert({
    where: { name: 'Women' },
    update: {},
    create: { name: 'Women', description: 'Women fashion' },
  })
  const men = await prisma.category.upsert({
    where: { name: 'Men' },
    update: {},
    create: { name: 'Men', description: 'Men fashion' },
  })

  const dresses = await prisma.subCategory.upsert({
    where: { name_categoryId: { name: 'Dresses', categoryId: women.id } },
    update: {},
    create: { name: 'Dresses', categoryId: women.id },
  })
  const tees = await prisma.subCategory.upsert({
    where: { name_categoryId: { name: 'T-Shirts', categoryId: men.id } },
    update: {},
    create: { name: 'T-Shirts', categoryId: men.id },
  })

  const creatorEmail = admin?.email || 'seed@local'

  const productDefs = [
    {
      name: 'Floral Midi Dress', subtitle: 'Elegant everyday wear', desc: 'A breathable floral midi dress crafted for all-day comfort.',
      price: 8500, cat: women, sub: dresses, featured: true, newArrival: true,
    },
    {
      name: 'Elegant Evening Gown', subtitle: 'Statement occasion wear', desc: 'A flowing evening gown with a refined silhouette.',
      price: 12500, cat: women, sub: dresses, featured: false, newArrival: false,
    },
    {
      name: 'Classic White Tee', subtitle: 'Essential staple', desc: 'A soft premium cotton tee, perfect for every wardrobe.',
      price: 3500, cat: men, sub: tees, featured: true, newArrival: false,
    },
    {
      name: 'Premium Cotton Polo', subtitle: 'Smart casual', desc: 'A tailored polo with a breathable cotton pique finish.',
      price: 5500, cat: men, sub: tees, featured: false, newArrival: true,
    },
  ]

  for (const def of productDefs) {
    const existing = await prisma.product.findFirst({ where: { prodName: def.name } })
    if (existing) continue

    const product = await prisma.product.create({
      data: {
        status: 'ACTIVE',
        stockStatus: true,
        prodMarket: 'MARKETPLACE',
        prodType: 'Product',
        prodCategoryName: def.cat.name,
        prodSubCategoryName: def.sub.name,
        prodName: def.name,
        prodSubtitle: def.subtitle,
        prodDescription: def.desc,
        prodImg: IMG,
        prodPrice: def.price,
        chargeTax: false,
        featuredOnHomepage: def.featured,
        showInNewArrivals: def.newArrival,
        createdBy: creatorEmail,
        updatedBy: creatorEmail,
        categoryId: def.cat.id,
        subCategoryId: def.sub.id,
        baseSku: `${def.cat.name.substring(0, 3).toUpperCase()}/${def.sub.name.substring(0, 3).toUpperCase()}/000001`,
        productImages: {
          create: { imageUrl: IMG, isPrimary: true },
        },
        productSkus: {
          create: [
            { skuCode: `${def.name.replace(/\s+/g, '-')}-S`, price: def.price, stock: 20, isActive: true },
            { skuCode: `${def.name.replace(/\s+/g, '-')}-M`, price: def.price, stock: 20, isActive: true },
            { skuCode: `${def.name.replace(/\s+/g, '-')}-L`, price: def.price, stock: 20, isActive: true },
          ],
        },
      },
    })

    await prisma.commonIndex.upsert({
      where: { name: def.cat.name },
      update: {},
      create: { name: def.cat.name, type: 'CATEGORY', code: def.cat.name.substring(0, 3).toUpperCase() },
    })
    await prisma.commonIndex.upsert({
      where: { name: def.sub.name },
      update: {},
      create: { name: def.sub.name, type: 'SUB_CATEGORY', code: def.sub.name.substring(0, 3).toUpperCase() },
    })

    console.log('Seeded demo product:', def.name, '(id', product.id, ')')
  }

  const firstProducts = await prisma.product.findMany({ orderBy: { id: 'asc' }, take: 2 })
  const existingOrder = await prisma.order.findFirst({ where: { email: customer.email } })
  if (!existingOrder && firstProducts.length === 2) {
    const [p1, p2] = firstProducts
    const sku1 = await prisma.productSku.findFirst({ where: { productId: p1.id } })
    const sku2 = await prisma.productSku.findFirst({ where: { productId: p2.id } })
    const item1Subtotal = Number(p1.prodPrice) * 1
    const item2Subtotal = Number(p2.prodPrice) * 2
    const subtotal = item1Subtotal + item2Subtotal
    const shippingFee = 0
    const tax = Math.round(subtotal * 0.08 * 100) / 100
    const total = subtotal + shippingFee + tax

    await prisma.order.create({
      data: {
        userId: customer.id,
        email: customer.email,
        firstName: 'Test',
        lastName: 'Customer',
        address: '123 Main Street',
        city: 'Colombo',
        state: 'Western',
        zipCode: '00100',
        phone: '+94770000000',
        paymentMethod: 'cash',
        status: 'pending',
        orderNumber: `ORD-${Date.now()}`,
        subtotal,
        shippingFee,
        tax,
        total,
        orderItems: {
          create: [
            {
              productId: p1.id,
              skuId: sku1?.id,
              productName: p1.prodName,
              price: p1.prodPrice,
              quantity: 1,
              subtotal: item1Subtotal,
            },
            {
              productId: p2.id,
              skuId: sku2?.id,
              productName: p2.prodName,
              price: p2.prodPrice,
              quantity: 2,
              subtotal: item2Subtotal,
            },
          ],
        },
      },
    })
    console.log('Seeded demo order for customer')
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
