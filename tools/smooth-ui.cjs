const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..', 'src')
const map = new Map([
  ['0', '10px'],
  ['2px', '6px'],
  ['3px', '6px'],
  ['4px', '8px'],
  ['6px', '10px'],
  ['8px', '12px'],
  ['10px', '14px'],
  ['12px', '16px'],
  ['14px', '18px'],
  ['16px', '20px'],
  ['18px', '22px'],
  ['20px', '24px'],
  ['24px', '28px'],
  ['32px', '36px'],
])

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.isFile() && full.endsWith('.css')) out.push(full)
  }
  return out
}

let changed = 0
for (const file of walk(root)) {
  const src = fs.readFileSync(file, 'utf8')
  const next = src.replace(/border-radius:\s*([^;!}]+)([;!}])/g, (m, value, end) => {
    const v = value.trim()
    if (v.includes('var(') || v.includes('%') || v.includes('999') || v.includes('/')) return m
    const parts = v.split(/\s+/)
    const mapped = parts.map(p => map.get(p) || p)
    if (mapped.join(' ') === v) return m
    return `border-radius: ${mapped.join(' ')}${end}`
  })
  if (next !== src) {
    fs.writeFileSync(file, next)
    changed++
  }
}
console.log(`Smoothed border-radius in ${changed} CSS files under src/.`)
