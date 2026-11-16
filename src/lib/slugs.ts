export function slugify(value: string, maxLength = 80): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
  return slug || 'item'
}

export function withSlugSuffix(base: string, suffix: string | number, maxLength = 80): string {
  const tail = `-${suffix}`
  const head = base.slice(0, Math.max(1, maxLength - tail.length)).replace(/-+$/g, '')
  return `${head}${tail}`
}
