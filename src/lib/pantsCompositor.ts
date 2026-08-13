import {
  computePantsBodyAnchors,
  resolveTryOnConfig,
  type HemLength,
  type Keypoint,
  type PartialTryOnConfig,
  type SkirtAnchors,
} from '@practics/tryon-core'

type SizedImage = CanvasImageSource & { width: number; height: number }

export type PantsPoseStatus = 'ok' | 'pose-not-anchorable'

export interface PantsPoseInput {
  frame: SizedImage
  maskBitmap: SizedImage
  keypoints: Keypoint[]
  garmentImage: SizedImage
  garmentAnchors: SkirtAnchors
  hemLength: HemLength
  config: PartialTryOnConfig
}

const HAND_EXTEND_FRAC = 0.45
const ALPHA_EDGE = 40
const FABRIC_MIN_ALPHA = 96
const MIN_KEYPOINT_SCORE = 0.3

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function findKeypoint(keypoints: Keypoint[], name: Keypoint['name']): Keypoint | undefined {
  return keypoints.find((k) => k.name === name)
}

/**
 * Restricts the person mask to the "pants zone": the body silhouette between
 * the waist (hip) line and the hem line, with soft vertical fade at both cut
 * edges. Returns the feathered mask used to clip the warped fabric plus an
 * edgeAt() reader that reports the body's actual left/right silhouette edge
 * at any row inside the zone - the warp uses those edges to stretch the
 * fabric all the way to the body instead of undershooting it.
 */
function buildPantsMask(
  maskBitmap: CanvasImageSource,
  keypoints: Keypoint[],
  waistY: number,
  hemY: number,
  w: number,
  h: number,
  config: PartialTryOnConfig
): { feathered: OffscreenCanvas; band: OffscreenCanvas; edgeAt: (y: number) => [number, number] | null } {
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not supported')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(maskBitmap, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  const px = imageData.data

  // The model-resolution mask is upscaled to the full frame, so its edge is
  // ~1 mask pixel wide (~5-6px at a 1500px frame). Snap the alpha with a
  // steep gain to compress that soft ramp back to ~1-2px of real
  // anti-aliasing: otherwise semi-transparent fabric paints a wide gray
  // ghosting fringe over the background around each leg.
  for (let i = 3; i < px.length; i += 4) {
    const a = px[i]
    px[i] = a <= 96 ? 0 : Math.min(255, (a - 96) * 6)
  }
  // Re-dilate ~2px so the fabric reaches the wearer's true silhouette edge
  // instead of stopping short and leaving the original (dark) garment edge
  // visible as a thin outline around the legs.
  {
    const alpha = new Uint8Array(w * h)
    for (let i = 0, j = 0; i < px.length; i += 4, j++) alpha[j] = px[i + 3]
    const dilated = new Uint8Array(w * h)
    const R = 2
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - R)
      const y1 = Math.min(h - 1, y + R)
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - R)
        const x1 = Math.min(w - 1, x + R)
        let maxA = 0
        for (let yy = y0; yy <= y1; yy++) {
          const base = yy * w
          for (let xx = x0; xx <= x1; xx++) {
            const v = alpha[base + xx]
            if (v > maxA) maxA = v
          }
        }
        dilated[y * w + x] = maxA
      }
    }
    for (let i = 0, j = 0; i < px.length; i += 4, j++) px[i + 3] = dilated[j]
  }

  const shoulderL = findKeypoint(keypoints, 'left_shoulder')
  const shoulderR = findKeypoint(keypoints, 'right_shoulder')
  const hipL = findKeypoint(keypoints, 'left_hip')
  const hipR = findKeypoint(keypoints, 'right_hip')
  const shoulderMidY = shoulderL && shoulderR ? (shoulderL.y + shoulderR.y) / 2 : h * 0.3
  const hipMidY = hipL && hipR ? (hipL.y + hipR.y) / 2 : waistY
  const torsoHeight = Math.max(1, Math.abs(hipMidY - shoulderMidY))

  // Soft vertical fades, shaped as smoothsteps so neither edge reads as a
  // band or a hard cut. The waist cut sits where the shirt hangs (a few
  // percent of torso, feathered over the fabric) and the hem cut ends a
  // couple of pixels above the shoe collar, staying fully opaque right up to
  // the break so the original trousers can't show through.
  const topSoft = Math.max(4, torsoHeight * 0.02)
  const bottomSoft = Math.max(3, torsoHeight * 0.006)
  const topY = waistY - torsoHeight * 0.02

  const smooth = (t: number) => t * t * (3 - 2 * t)
  for (let y = 0; y < h; y++) {
    let mult: number
    if (y < topY - topSoft) mult = 0
    else if (y < topY) mult = smooth((y - (topY - topSoft)) / topSoft)
    else if (y <= hemY - bottomSoft) mult = 1
    else if (y <= hemY) mult = smooth((hemY - y) / bottomSoft)
    else mult = 0
    if (mult === 1) continue
    const row = y * w
    for (let x = 0; x < w; x++) {
      const i = (row + x) * 4 + 3
      px[i] = Math.round(px[i] * mult)
    }
  }

  const edgeAt = (y: number): [number, number] | null => {
    const row = clamp(Math.round(y), 0, h - 1)
    let l = -1
    let r = -1
    for (let x = 0; x < w; x++) {
      if (px[(row * w + x) * 4 + 3] > ALPHA_EDGE) {
        if (l === -1) l = x
        r = x
      }
    }
    return l === -1 ? null : [l, r]
  }

  ctx.putImageData(imageData, 0, 0)

  const band = new OffscreenCanvas(w, h)
  const bctx = band.getContext('2d')
  if (!bctx) throw new Error('Canvas 2D not supported')
  bctx.imageSmoothingEnabled = true
  bctx.imageSmoothingQuality = 'high'
  bctx.drawImage(canvas, 0, 0)

  const feathered = new OffscreenCanvas(w, h)
  const fctx = feathered.getContext('2d')
  if (!fctx) throw new Error('Canvas 2D not supported')
  fctx.imageSmoothingEnabled = true
  fctx.imageSmoothingQuality = 'high'
  fctx.filter = `blur(${Math.max(2, Math.round(w / 300))}px)`
  fctx.drawImage(canvas, 0, 0)
  fctx.filter = 'none'
  return { feathered, band, edgeAt }
}

/**
 * When the ankle keypoints aren't confident enough, the fallback hem can sit
 * too high (pants stopping mid-calf) or even below the feet. This reads the
 * lowest person-mask row in the central column range and snaps the hem to a
 * few percent above it, so the trousers reach the ankles without spilling
 * over the shoes. Uses the raw mask before waist/hem edits (maskBitmap).
 */
function findMaskBottom(maskBitmap: CanvasImageSource, w: number, h: number): number {
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not supported')
  ctx.drawImage(maskBitmap, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data
  const x0 = Math.round(w * 0.3)
  const x1 = Math.round(w * 0.7)
  for (let y = h - 1; y >= 0; y--) {
    const row = y * w
    for (let x = x0; x <= x1; x++) {
      if (px[(row + x) * 4 + 3] > ALPHA_EDGE) return y
    }
  }
  return h - 1
}

/**
 * Resolves where the trousers end. The trouser "break" is defined by the
 * ankle keypoints when confidently visible (the break sits right at the shoe
 * collar), otherwise by the person-mask bottom: the hem never passes the
 * shoe line (maskBottom - shoeGap), so fabric can never spill over the
 * shoes. Knee-length hems stay at the detected knee, never lower than the
 * shoe line either.
 */
function clampHemY(
  rawHemY: number,
  maskBottom: number,
  torsoHeight: number,
  wantAnkleLength: boolean,
  anklesConfident: boolean
): number {
  const shoeGap = Math.max(6, torsoHeight * 0.04)
  const maxHem = Math.max(1, maskBottom - shoeGap)
  if (wantAnkleLength && !anklesConfident) return maxHem
  return Math.min(rawHemY, maxHem)
}

/**
 * Bounding box of the pants-zone mask (the "base model" the garment must
 * stay on). Every destination anchor is clamped into this box so a keypoint
 * glitch (e.g. an ankle detected off-body) can never drag the warped fabric
 * across the background or onto the shoes.
 */
function computePantsBounds(band: CanvasImageSource, w: number, h: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not supported')
  ctx.drawImage(band, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      if (px[(row + x) * 4 + 3] > ALPHA_EDGE) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (minX === Infinity) return { minX: 0, maxX: w - 1, minY: 0, maxY: h - 1 }
  return { minX, maxX, minY, maxY }
}

interface GarmentRow {
  l: number
  r: number
  rgb: Uint8ClampedArray
}

const GARMENT_ALPHA_MIN = 24

/**
 * Pre-computes each garment row's opaque span plus an alpha-preserved RGB
 * copy in which interior transparent runs (the crotch notch between the
 * legs, cutout holes) are filled with the adjacent leg fabric. Outer
 * background stays transparent so the person-mask clip alone decides the
 * silhouette - the original trousers can never bleed through the interior.
 * The row span is inset by 1px each side so the product cutout's faint gray
 * edge ring is never sampled (it would read as a dark outline on the legs).
 */
function buildGarmentRows(gp: Uint8ClampedArray, gW: number, gH: number): GarmentRow[] {
  const rows: GarmentRow[] = []
  for (let y = 0; y < gH; y++) {
    const rgb = gp.subarray(y * gW * 4, (y + 1) * gW * 4)
    let l = -1
    let r = -1
    for (let x = 0; x < gW; x++) {
      if (rgb[x * 4 + 3] > GARMENT_ALPHA_MIN) {
        if (l === -1) l = x
        r = x
      }
    }
    if (l !== -1) {
      let x = 0
      while (x < gW) {
        if (rgb[x * 4 + 3] > GARMENT_ALPHA_MIN) {
          x++
          continue
        }
        const start = x
        while (x < gW && rgb[x * 4 + 3] <= GARMENT_ALPHA_MIN) x++
        const end = x - 1
        const leftOpaque = start > 0 && rgb[(start - 1) * 4 + 3] > GARMENT_ALPHA_MIN
        const rightOpaque = end < gW - 1 && rgb[(end + 1) * 4 + 3] > GARMENT_ALPHA_MIN
        if (!leftOpaque || !rightOpaque) continue
        const li = (start - 1) * 4
        for (let f = start; f <= end; f++) {
          rgb[f * 4] = rgb[li]
          rgb[f * 4 + 1] = rgb[li + 1]
          rgb[f * 4 + 2] = rgb[li + 2]
          rgb[f * 4 + 3] = 255
        }
      }
    }
    const innerL = l === -1 ? 0 : Math.min(l + 1, gW - 1)
    const innerR = r === -1 ? gW - 1 : Math.max(r - 1, 0)
    rows.push({ l: innerL <= innerR ? innerL : innerR, r: innerR, rgb })
  }
  return rows
}

/**
 * Bilinear sample of a filled garment row at fractional x. Colors are
 * blended premultiplied by alpha so the garment's own soft cutout edges
 * stay clean instead of fringing.
 */
function sampleRow(row: GarmentRow, gx: number): [number, number, number, number] {
  const width = row.rgb.length / 4
  const sx = clamp(gx, 0, width - 1)
  const x0 = Math.floor(sx)
  const x1 = Math.min(width - 1, x0 + 1)
  const fx = sx - x0
  const i0 = x0 * 4
  const i1 = x1 * 4
  const a0 = row.rgb[i0 + 3] / 255
  const a1 = row.rgb[i1 + 3] / 255
  const a = a0 + (a1 - a0) * fx
  const ch = (c0: number, c1: number) => (a > 0 ? (c0 * a0 * (1 - fx) + c1 * a1 * fx) / a : 0)
  return [
    ch(row.rgb[i0], row.rgb[i1]),
    ch(row.rgb[i0 + 1], row.rgb[i1 + 1]),
    ch(row.rgb[i0 + 2], row.rgb[i1 + 2]),
    a * 255,
  ]
}

/**
 * Finds the last "pants-colored" (bright) row of the product cutout, i.e.
 * the hem line just above the model's own shoes. Flat-lay product photos of
 * trousers usually include a pair of (black) dress shoes below the hem; if
 * those rows were sampled, the wearer's ankles would be painted with the
 * product's black shoes. Rows that are mostly transparent (the legs-spread
 * notch) are ignored, and a luminance threshold separates the light tan
 * fabric from the dark shoes. Returns -1 when no bright hem is found (the
 * whole cutout is then used).
 */
function detectPantsHemY(gp: Uint8ClampedArray, gW: number, gH: number): number {
  let lastBright = -1
  for (let y = 0; y < gH; y++) {
    const row = y * gW
    let sum = 0
    let n = 0
    for (let x = 0; x < gW; x++) {
      if (gp[(row + x) * 4 + 3] <= GARMENT_ALPHA_MIN) continue
      const i = (row + x) * 4
      sum += 0.299 * gp[i] + 0.587 * gp[i + 1] + 0.114 * gp[i + 2]
      n++
    }
    if (n > gW * 0.15 && sum / n > 96) lastBright = y
  }
  return lastBright
}

/**
 * Renders the trousers onto a full-frame layer with a per-row vertical warp
 * ("scale_y") instead of a TPS mesh. Each output row between the waistline
 * and the hem samples one row of the product image (linear in y), stretched
 * horizontally to the wearer's silhouette edges at that row (linear in x).
 * There are no triangle seams, no folded control points and no under-sampled
 * magnification: the fabric drapes naturally from the waist down to the
 * ankles at full resolution and is clipped to the pants zone by the person
 * mask (band alpha), so nothing spills past the hem onto the shoes.
 */
function renderPantsLayer(
  garment: SizedImage,
  src: SkirtAnchors,
  band: CanvasImageSource,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  edgeAt: (y: number) => [number, number] | null,
  waistY: number,
  hemY: number,
  w: number,
  h: number
): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const octx = out.getContext('2d')
  if (!octx) throw new Error('Canvas 2D not supported')

  const gctx = document.createElement('canvas').getContext('2d')
  if (!gctx) throw new Error('Canvas 2D not supported')
  gctx.canvas.width = garment.width
  gctx.canvas.height = garment.height
  gctx.drawImage(garment, 0, 0)
  const gp = gctx.getImageData(0, 0, garment.width, garment.height).data
  const gW = garment.width
  const gH = garment.height
  if (gW <= 0 || gH <= 0) return out
  const rows = buildGarmentRows(gp, gW, gH)

  const bctx = document.createElement('canvas').getContext('2d')
  if (!bctx) throw new Error('Canvas 2D not supported')
  bctx.canvas.width = w
  bctx.canvas.height = h
  bctx.drawImage(band, 0, 0, w, h)
  const bp = bctx.getImageData(0, 0, w, h).data

  const srcWaistY = (src.waistL[1] + src.waistR[1]) / 2
  const rawSrcHemY = (src.hemL[1] + src.hemR[1]) / 2
  // The product cutout includes its own shoes below the pants hem. Crop the
  // bottom ~12% of the fabric span - extended upward to the last bright row
  // (detectPantsHemY) when the shoe region is taller - so ONLY trouser
  // fabric is sampled and the base model's own shoes are never painted.
  const detectedHemY = detectPantsHemY(gp, gW, gH)
  const guaranteedCrop = (rawSrcHemY - srcWaistY) * 0.12
  let shoeCrop = guaranteedCrop
  if (detectedHemY >= 0 && detectedHemY < rawSrcHemY) {
    shoeCrop = Math.max(guaranteedCrop, rawSrcHemY - detectedHemY)
  }
  const srcHemY = Math.max(srcWaistY + 1, rawSrcHemY - shoeCrop)
  const srcSpan = Math.max(1, srcHemY - srcWaistY)

  const data = octx.createImageData(w, h)
  const op = data.data
  const y0 = clamp(Math.round(waistY), 0, h - 1)
  const y1 = clamp(Math.round(hemY), 0, h - 1)
  if (y1 <= y0) return out
  const ySpan = y1 - y0

  for (let y = y0; y <= y1; y++) {
    const edge = edgeAt(y)
    if (!edge) continue
    const dL = Math.max(edge[0], bounds.minX)
    const dR = Math.min(edge[1], bounds.maxX)
    if (dR - dL < 1) continue
    const t = (y - y0) / ySpan
    const sy = srcWaistY + t * srcSpan
    const sy0 = clamp(Math.floor(sy), 0, gH - 1)
    const sy1 = clamp(sy0 + 1, 0, gH - 1)
    const fy = sy - sy0
    const r0 = rows[sy0]
    const r1 = rows[sy1]
    const span0 = Math.max(1, r0.r - r0.l)
    const span1 = Math.max(1, r1.r - r1.l)
    const rowOff = y * w
    for (let x = dL; x <= dR; x++) {
      const bandA = bp[(rowOff + x) * 4 + 3]
      if (bandA <= 8) continue
      const tx = (x - dL) / (dR - dL)
      const a = sampleRow(r0, r0.l + tx * span0)
      const b = sampleRow(r1, r1.l + tx * span1)
      const o = (rowOff + x) * 4
      op[o] = a[0] + (b[0] - a[0]) * fy
      op[o + 1] = a[1] + (b[1] - a[1]) * fy
      op[o + 2] = a[2] + (b[2] - a[2]) * fy
      op[o + 3] = Math.round((a[3] + (b[3] - a[3]) * fy) * (bandA / 255))
    }
  }
  octx.putImageData(data, 0, 0)
  return out
}

/**
 * Replacement composite. The frame is drawn first, then the fabric is
 * painted only inside the pants zone. The feathered person mask is the sole
 * source of alpha - it smooths the silhouette, waist, and hem edges in one
 * blur of the snapped mask - while the garment's own alpha is a binary gate
 * so its cutout fringe can never bleed a grey outline onto the background or
 * tint the shoes. Pixels carrying no real fabric stay transparent.
 */
function compositePants(
  ctx: CanvasRenderingContext2D,
  frame: CanvasImageSource,
  layer: SizedImage,
  feathered: CanvasImageSource,
  band: CanvasImageSource,
  w: number,
  h: number
) {
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const octx = out.getContext('2d')
  if (!octx) throw new Error('Canvas 2D not supported')

  const lctx = document.createElement('canvas').getContext('2d')
  if (!lctx) throw new Error('Canvas 2D not supported')
  lctx.canvas.width = w
  lctx.canvas.height = h
  lctx.drawImage(layer, 0, 0)
  const lp = lctx.getImageData(0, 0, w, h).data

  const fctx = document.createElement('canvas').getContext('2d')
  if (!fctx) throw new Error('Canvas 2D not supported')
  fctx.canvas.width = w
  fctx.canvas.height = h
  fctx.drawImage(feathered, 0, 0)
  const fp = fctx.getImageData(0, 0, w, h).data

  const bctx = document.createElement('canvas').getContext('2d')
  if (!bctx) throw new Error('Canvas 2D not supported')
  bctx.canvas.width = w
  bctx.canvas.height = h
  bctx.drawImage(band, 0, 0)
  const bp = bctx.getImageData(0, 0, w, h).data

  const data = octx.createImageData(w, h)
  const op = data.data
  for (let i = 0; i < w * h; i++) {
    const m = bp[i * 4 + 3]
    const wa = lp[i * 4 + 3]
    if (m <= 8 || wa < FABRIC_MIN_ALPHA) continue
    // The feathered mask is the single source of alpha: a smooth blur of the
    // snapped person mask that anti-aliases the silhouette, waist and hem in
    // one pass. The garment's own alpha is only a binary gate, so its cutout
    // fringe can never tint the edge grey over the background.
    const a = fp[i * 4 + 3]
    if (a <= 0) continue
    op[i * 4] = lp[i * 4]
    op[i * 4 + 1] = lp[i * 4 + 1]
    op[i * 4 + 2] = lp[i * 4 + 2]
    op[i * 4 + 3] = Math.round(a)
  }
  octx.putImageData(data, 0, 0)

  ctx.drawImage(frame, 0, 0)
  ctx.drawImage(out, 0, 0)
}

/** Restores original frame pixels along each arm/hand that hangs into the pants zone, so hands in pockets and arms at the sides occlude the fabric instead of being painted over. */
function restoreSegment(ctx: CanvasRenderingContext2D, frame: CanvasImageSource, x1: number, y1: number, x2: number, y2: number, r: number) {
  ctx.save()
  capsulePath(ctx, x1, y1, x2, y2, r)
  ctx.clip()
  ctx.drawImage(frame, 0, 0)
  ctx.restore()
}

function drawArmOcclusionPants(
  ctx: CanvasRenderingContext2D,
  frame: CanvasImageSource,
  keypoints: Keypoint[],
  waistY: number,
  config: PartialTryOnConfig
) {
  const byName = new Map(keypoints.map((k) => [k.name, k]))
  const shoulderL = byName.get('left_shoulder')
  const shoulderR = byName.get('right_shoulder')
  const minScore = MIN_KEYPOINT_SCORE
  if (!shoulderL || !shoulderR || shoulderL.score < minScore || shoulderR.score < minScore) return
  const shoulderWidth = Math.hypot(shoulderR.x - shoulderL.x, shoulderR.y - shoulderL.y)
  if (shoulderWidth <= 0) return
  const radius = Math.max(2, shoulderWidth * (config.armOcclusionRadiusFactor ?? 0.14))

  for (const [shoulder, elbow, wrist] of [
    ['left_shoulder', 'left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow', 'right_wrist'],
  ] as const) {
    const s = byName.get(shoulder)
    const e = byName.get(elbow)
    const wn = byName.get(wrist)
    if (!s || !e || !wn || s.score < minScore || e.score < minScore || wn.score < minScore) continue
    const ex = wn.x + (wn.x - e.x) * HAND_EXTEND_FRAC
    const ey = wn.y + (wn.y - e.y) * HAND_EXTEND_FRAC
    if (e.y < waistY && ey < waistY) continue
    restoreSegment(ctx, frame, s.x, s.y, e.x, e.y, radius)
    restoreSegment(ctx, frame, e.x, e.y, wn.x, wn.y, radius)
    restoreSegment(ctx, frame, wn.x, wn.y, ex, ey, radius)
  }
}

function capsulePath(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, r: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * r
  const ny = (dx / len) * r
  const angle = Math.atan2(dy, dx)
  ctx.beginPath()
  ctx.moveTo(x1 + nx, y1 + ny)
  ctx.lineTo(x2 + nx, y2 + ny)
  ctx.arc(x2, y2, r, angle - Math.PI / 2, angle + Math.PI / 2)
  ctx.lineTo(x1 - nx, y1 - ny)
  ctx.arc(x1, y1, r, angle + Math.PI / 2, angle + Math.PI * 1.5)
  ctx.closePath()
}

/**
 * Pants try-on that replaces the original lower-body garment. The frame is
 * drawn unchanged; only the trousers are composited on top, vertically
 * scaled from the detected waistline (hip keypoints) down to the hem and
 * horizontally fitted to the person's silhouette edges via the person mask,
 * clipped to the pants zone (person silhouette between waist and hem) so
 * they stop right above the shoes. Face, torso, arms, skin below a
 * knee-length hem, shoes, pose, proportions, and background are all
 * untouched. Returns 'pose-not-anchorable' (and draws just the frame) when
 * the torso isn't confidently visible enough to place the waistband.
 */
export function renderPantsToPose(ctx: CanvasRenderingContext2D, input: PantsPoseInput): PantsPoseStatus {
  const { frame, maskBitmap, keypoints } = input
  const w = frame.width
  const h = frame.height
  const config = resolveTryOnConfig(input.config)

  const body = computePantsBodyAnchors(keypoints, input.hemLength, config)
  if (!body) return 'pose-not-anchorable'

  // The trouser waistband sits at the hip-joint line in a natural stance.
  // computePantsBodyAnchors places its "waist" at hip + 0.15*torsoHeight
  // (it reuses the hip-length top hem offset), which pushed the whole
  // garment ~15-20% too low; the overlay must start at the actual hips.
  const minScore = config.minKeypointScore ?? MIN_KEYPOINT_SCORE
  const hipL = findKeypoint(keypoints, 'left_hip')
  const hipR = findKeypoint(keypoints, 'right_hip')
  const waistY = hipL && hipR ? (hipL.y + hipR.y) / 2 : (body.waistL[1] + body.waistR[1]) / 2

  const shoulderL = findKeypoint(keypoints, 'left_shoulder')
  const shoulderR = findKeypoint(keypoints, 'right_shoulder')
  const shoulderMidY = shoulderL && shoulderR ? (shoulderL.y + shoulderR.y) / 2 : h * 0.3
  const torsoHeight = Math.max(1, Math.abs(waistY - shoulderMidY))

  const rawHemY = (body.hemL[1] + body.hemR[1]) / 2
  const maskBottom = findMaskBottom(maskBitmap, w, h)
  const ankleL = findKeypoint(keypoints, 'left_ankle')
  const ankleR = findKeypoint(keypoints, 'right_ankle')
  const anklesConfident = !!(ankleL && ankleR && ankleL.score >= minScore && ankleR.score >= minScore)
  const hemY = clampHemY(rawHemY, maskBottom, torsoHeight, input.hemLength === 'ankle', anklesConfident)

  // Lift the waistband ~5% of the pants-zone height so the crotch/hip anchor
  // lines up with the wearer's hands in his pockets instead of sitting below
  // them. The hem stays put; only the top of the overlay moves.
  const pantsWaistY = waistY - Math.max(2, (hemY - waistY) * 0.05)

  const { feathered, band, edgeAt } = buildPantsMask(maskBitmap, keypoints, pantsWaistY, hemY, w, h, config)
  const bounds = computePantsBounds(band, w, h)
  const layer = renderPantsLayer(input.garmentImage, input.garmentAnchors, band, bounds, edgeAt, pantsWaistY, hemY, w, h)

  compositePants(ctx, frame, layer, feathered, band, w, h)
  drawArmOcclusionPants(ctx, frame, keypoints, pantsWaistY, config)
  return 'ok'
}
