import { cropToAlphaBBox, findAlphaBBox, suggestAnchors, type GarmentAnchors, type SkirtAnchors } from '@practics/tryon-core'

export interface PreparedGarment {
  bitmap: ImageBitmap
  anchors: GarmentAnchors
  pantsAnchors: SkirtAnchors
  width: number
  height: number
  tall: boolean
}

const MAX_DIM = 900
const BG_THRESHOLD = 45
const GRID_SIZE = 24
const SAMPLE_STEP = 24
const SAMPLE_RADIUS = 4

function sampleRegion(data: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, r: number) {
  let sr = 0
  let sg = 0
  let sb = 0
  let n = 0
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue
      const i = (y * w + x) * 4
      sr += data[i]
      sg += data[i + 1]
      sb += data[i + 2]
      n++
    }
  }
  return n ? [sr / n, sg / n, sb / n] : [0, 0, 0]
}

function sampleBorderPoints(data: Uint8ClampedArray, w: number, h: number) {
  const points: { x: number; y: number; rgb: number[] }[] = []
  const add = (x: number, y: number) => points.push({ x, y, rgb: sampleRegion(data, w, h, x, y, SAMPLE_RADIUS) })
  for (let x = SAMPLE_RADIUS; x < w - SAMPLE_RADIUS; x += SAMPLE_STEP) {
    add(x, SAMPLE_RADIUS)
    add(x, h - 1 - SAMPLE_RADIUS)
  }
  for (let y = SAMPLE_RADIUS; y < h - SAMPLE_RADIUS; y += SAMPLE_STEP) {
    add(SAMPLE_RADIUS, y)
    add(w - 1 - SAMPLE_RADIUS, y)
  }
  return points
}

function buildBackgroundGrid(points: { x: number; y: number; rgb: number[] }[], w: number, h: number, gridSize: number) {
  const grid = new Float32Array(gridSize * gridSize * 3)
  for (let gy = 0; gy < gridSize; gy++) {
    const py = (gy / (gridSize - 1)) * (h - 1)
    for (let gx = 0; gx < gridSize; gx++) {
      const px = (gx / (gridSize - 1)) * (w - 1)
      let sumR = 0
      let sumG = 0
      let sumB = 0
      let sumW = 0
      for (const p of points) {
        const dx = p.x - px
        const dy = p.y - py
        const weight = 1 / (dx * dx + dy * dy + 1)
        sumR += p.rgb[0] * weight
        sumG += p.rgb[1] * weight
        sumB += p.rgb[2] * weight
        sumW += weight
      }
      const idx = (gy * gridSize + gx) * 3
      grid[idx] = sumR / sumW
      grid[idx + 1] = sumG / sumW
      grid[idx + 2] = sumB / sumW
    }
  }
  return grid
}

function sampleGridBilinear(grid: Float32Array, gridSize: number, w: number, h: number, x: number, y: number) {
  const gx = (x / (w - 1)) * (gridSize - 1)
  const gy = (y / (h - 1)) * (gridSize - 1)
  const gx0 = Math.floor(gx)
  const gy0 = Math.floor(gy)
  const gx1 = Math.min(gridSize - 1, gx0 + 1)
  const gy1 = Math.min(gridSize - 1, gy0 + 1)
  const fx = gx - gx0
  const fy = gy - gy0
  const at = (ix: number, iy: number, c: number) => grid[(iy * gridSize + ix) * 3 + c]
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  return [0, 1, 2].map((c) =>
    lerp(lerp(at(gx0, gy0, c), at(gx1, gy0, c), fx), lerp(at(gx0, gy1, c), at(gx1, gy1, c), fx), fy)
  )
}

function floodFillBackgroundMask(w: number, h: number, data: Uint8ClampedArray, grid: Float32Array, gridSize: number, high: number) {
  const n = w * h
  const isBackground = new Uint8Array(n)
  const visited = new Uint8Array(n)
  const stack = new Int32Array(n)
  let sp = 0

  const distAt = (idx: number) => {
    const x = idx % w
    const y = (idx - x) / w
    const i = idx * 4
    const [bgR, bgG, bgB] = sampleGridBilinear(grid, gridSize, w, h, x, y)
    const dr = data[i] - bgR
    const dg = data[i + 1] - bgG
    const db = data[i + 2] - bgB
    return Math.sqrt(dr * dr + dg * dg + db * db)
  }

  const seed = (idx: number) => {
    if (visited[idx]) return
    visited[idx] = 1
    if (distAt(idx) <= high) {
      isBackground[idx] = 1
      stack[sp++] = idx
    }
  }
  for (let x = 0; x < w; x++) {
    seed(x)
    seed((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    seed(y * w)
    seed(y * w + w - 1)
  }

  while (sp > 0) {
    const idx = stack[--sp]
    const x = idx % w
    const y = (idx - x) / w
    const neighbors = [
      x > 0 ? idx - 1 : -1,
      x < w - 1 ? idx + 1 : -1,
      y > 0 ? idx - w : -1,
      y < h - 1 ? idx + w : -1,
    ]
    for (const nb of neighbors) {
      if (nb >= 0 && !visited[nb]) {
        visited[nb] = 1
        if (distAt(nb) <= high) {
          isBackground[nb] = 1
          stack[sp++] = nb
        }
      }
    }
  }
  return isBackground
}

function despeckleAlpha(data: Uint8ClampedArray, w: number, h: number) {
  const src = new Uint8ClampedArray(data.length)
  for (let i = 3; i < data.length; i += 4) src[i] = data[i]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          sum += src[(ny * w + nx) * 4 + 3]
          n++
        }
      }
      data[(y * w + x) * 4 + 3] = Math.round(sum / n)
    }
  }
}

function keepLargestComponent(data: Uint8ClampedArray, w: number, h: number, threshold = 100) {
  const n = w * h
  const labels = new Int32Array(n).fill(-1)
  const sizes: number[] = []
  const stack = new Int32Array(n)
  for (let start = 0; start < n; start++) {
    if (labels[start] !== -1 || data[start * 4 + 3] <= threshold) continue
    const label = sizes.length
    let sp = 0
    stack[sp++] = start
    labels[start] = label
    let size = 0
    while (sp > 0) {
      const idx = stack[--sp]
      size++
      const x = idx % w
      const y = (idx - x) / w
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < w - 1 ? idx + 1 : -1,
        y > 0 ? idx - w : -1,
        y < h - 1 ? idx + w : -1,
      ]
      for (const nb of neighbors) {
        if (nb >= 0 && labels[nb] === -1 && data[nb * 4 + 3] > threshold) {
          labels[nb] = label
          stack[sp++] = nb
        }
      }
    }
    sizes.push(size)
  }
  if (sizes.length <= 1) return
  let largest = 0
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[largest]) largest = i
  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1 && labels[i] !== largest) data[i * 4 + 3] = 0
  }
}

function removeBackgroundCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not supported')
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = new Uint8ClampedArray(imageData.data)

  const points = sampleBorderPoints(data, width, height)
  const grid = buildBackgroundGrid(points, width, height, GRID_SIZE)
  const isBackground = floodFillBackgroundMask(width, height, data, grid, GRID_SIZE, BG_THRESHOLD)

  for (let i = 0; i < width * height; i++) {
    data[i * 4 + 3] = isBackground[i] ? 0 : 255
  }
  despeckleAlpha(data, width, height)
  keepLargestComponent(data, width, height)

  ctx.putImageData(new ImageData(data, width, height), 0, 0)
}

function pantsRowExtents(alphaData: Uint8ClampedArray, w: number, h: number, threshold: number) {
  const rows: (null | [number, number])[] = new Array(h)
  for (let y = 0; y < h; y++) {
    let minX = -1
    let maxX = -1
    for (let x = 0; x < w; x++) {
      if (alphaData[(y * w + x) * 4 + 3] > threshold) {
        if (minX === -1) minX = x
        maxX = x
      }
    }
    rows[y] = minX === -1 ? null : [minX, maxX]
  }
  return rows
}

export function suggestPantsAnchors(alphaData: Uint8ClampedArray, w: number, h: number): SkirtAnchors {
  const threshold = 10
  const bbox = findAlphaBBox(alphaData, w, h, threshold)
  if (!bbox) throw new Error('Pants image is empty')
  const bboxH = bbox.maxY - bbox.minY
  if (bboxH <= 0) throw new Error('Pants image is empty')

  const rows = pantsRowExtents(alphaData, w, h, threshold)

  const waistBandEnd = Math.min(bbox.maxY, bbox.minY + Math.round(bboxH * 0.2))
  let waistY = bbox.minY
  let waistWidth = -1
  for (let y = bbox.minY; y <= waistBandEnd; y++) {
    const r = rows[y]
    if (!r) continue
    const width = r[1] - r[0]
    if (width > waistWidth) {
      waistWidth = width
      waistY = y
    }
  }
  const waistRow = rows[waistY]
  if (!waistRow) throw new Error('Pants image is empty')

  const hemBandStart = Math.max(bbox.minY, bbox.maxY - Math.round(bboxH * 0.08))
  let sumL = 0
  let sumR = 0
  let n = 0
  for (let y = hemBandStart; y <= bbox.maxY; y++) {
    const r = rows[y]
    if (!r) continue
    sumL += r[0]
    sumR += r[1]
    n++
  }

  return {
    waistL: [waistRow[0], waistY],
    waistR: [waistRow[1], waistY],
    hemL: [n > 0 ? sumL / n : waistRow[0], bbox.maxY],
    hemR: [n > 0 ? sumR / n : waistRow[1], bbox.maxY],
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load garment image'))
    img.src = url
  })
}

export async function prepareGarment(url: string): Promise<PreparedGarment | null> {
  const img = await loadImage(url)
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not supported')
  ctx.drawImage(img, 0, 0, w, h)

  removeBackgroundCanvas(canvas)

  const bitmap = await createImageBitmap(canvas)
  const cropped = await cropToAlphaBBox(bitmap)
  if (!cropped) return null

  const anchors = suggestAnchors(cropped.alphaData, cropped.width, cropped.height)
  if (!anchors) return null

  const pantsAnchors = suggestPantsAnchors(cropped.alphaData, cropped.width, cropped.height)
  const tall = cropped.height > cropped.width * 1.4

  return {
    bitmap: cropped.bitmap,
    anchors,
    pantsAnchors,
    width: cropped.width,
    height: cropped.height,
    tall,
  }
}
