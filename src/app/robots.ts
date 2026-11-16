import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/siteUrl'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/customer/shop', '/customer/category', '/customer/product', '/customer/men', '/customer/women'],
        disallow: ['/admin/', '/api/', '/signin', '/signup', '/customer/account', '/customer/cart'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
