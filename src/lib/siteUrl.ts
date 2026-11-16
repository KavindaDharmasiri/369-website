const fallback = 'http://localhost:3000'

function normalize(url: string) {
  return url.replace(/\/$/, '')
}

export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL
  if (explicit) return normalize(explicit)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL)}`
  if (process.env.VERCEL_URL) return `https://${normalize(process.env.VERCEL_URL)}`
  return fallback
}

export function absoluteUrl(path = '/') {
  return new URL(path.startsWith('/') ? path : `/${path}`, `${getSiteUrl()}/`).toString()
}
