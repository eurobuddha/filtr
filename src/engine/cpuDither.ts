import type { DitherMethod, DitheringParams } from '@/state/types'
import type { RenderTarget } from './framebuffer'

const ERROR_DIFFUSION: DitherMethod[] = [
  'floydSteinberg',
  'atkinson',
  'jarvisJudiceNinke',
  'stucki',
  'burkes',
  'sierra',
  'sierraTwoRow',
  'sierraLite',
]

export function isErrorDiffusion(m: DitherMethod): boolean {
  return ERROR_DIFFUSION.includes(m)
}

/** Index into the GPU ordered-dither shader. Diffusion methods → 8×8 fallback. */
export function ditherMethodIndex(m: DitherMethod): number {
  switch (m) {
    case 'bayer2x2': return 8
    case 'bayer4x4': return 9
    case 'bayer8x8': return 10
    case 'bayer16x16': return 11
    case 'clusteredDot': return 12
    case 'blueNoise': return 13
    case 'interleavedGradient': return 14
    default: return 10
  }
}

type Tap = [number, number, number]
const KERNELS: Record<string, { div: number; taps: Tap[] }> = {
  floydSteinberg: { div: 16, taps: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] },
  atkinson: { div: 8, taps: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]] },
  jarvisJudiceNinke: {
    div: 48,
    taps: [[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]],
  },
  stucki: {
    div: 42,
    taps: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]],
  },
  burkes: { div: 32, taps: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]] },
  sierra: { div: 32, taps: [[1, 0, 5], [2, 0, 3], [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2], [-1, 2, 2], [0, 2, 3], [1, 2, 2]] },
  sierraTwoRow: { div: 16, taps: [[1, 0, 4], [2, 0, 3], [-2, 1, 1], [-1, 1, 2], [0, 1, 3], [1, 1, 2], [2, 1, 1]] },
  sierraLite: { div: 4, taps: [[1, 0, 2], [-1, 1, 1], [0, 1, 1]] },
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const q = (v: number, levels: number) => Math.round(clamp01(v) * (levels - 1)) / (levels - 1)

function diffuse(buf: Float32Array, w: number, h: number, levels: number, method: DitherMethod) {
  const k = KERNELS[method] ?? KERNELS.floydSteinberg
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const old = buf[i]
      const nv = q(old, levels)
      const err = old - nv
      buf[i] = nv
      for (const [dx, dy, wt] of k.taps) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        buf[ny * w + nx] += (err * wt) / k.div
      }
    }
}

export function computeCpuDither(
  gl: WebGL2RenderingContext,
  prepRT: RenderTarget,
  w: number,
  h: number,
  d: DitheringParams,
  palArr: Float32Array,
  palCount: number,
): Uint8Array | null {
  if (w <= 0 || h <= 0) return null
  const px = new Uint8Array(w * h * 4)
  gl.bindFramebuffer(gl.FRAMEBUFFER, prepRT.fbo)
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px)
  const out = new Uint8Array(w * h * 4)
  const g = Math.max(0.01, d.gamma)
  const fg = hexF(d.foregroundColor)
  const bg = hexF(d.backgroundColor)

  const perChannel = d.colorMode === 'rgb' || d.colorMode === 'original'
  if (perChannel) {
    const levels = d.colorMode === 'rgb' ? d.paletteSize : d.colorLevels
    for (let c = 0; c < 3; c++) {
      const buf = new Float32Array(w * h)
      for (let i = 0; i < w * h; i++) buf[i] = Math.pow(px[i * 4 + c] / 255, 1 / g)
      diffuse(buf, w, h, Math.max(2, levels), d.method)
      for (let i = 0; i < w * h; i++) out[i * 4 + c] = Math.round(buf[i] * 255)
    }
    for (let i = 0; i < w * h; i++) out[i * 4 + 3] = 255
    return out
  }

  // luminance-based modes (mono / tonal / indexed)
  const buf = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 4] / 255, gg = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255
    buf[i] = Math.pow(0.2126 * r + 0.7152 * gg + 0.0722 * b, 1 / g)
  }
  const levels = d.colorMode === 'mono' ? 2 : d.colorMode === 'indexed' ? palCount : d.colorLevels
  diffuse(buf, w, h, Math.max(2, levels), d.method)
  for (let i = 0; i < w * h; i++) {
    const t = buf[i]
    let r: number, gg: number, b: number
    if (d.colorMode === 'indexed') {
      const idx = Math.min(palCount - 1, Math.max(0, Math.round(t * (palCount - 1))))
      r = palArr[idx * 3] * 255
      gg = palArr[idx * 3 + 1] * 255
      b = palArr[idx * 3 + 2] * 255
    } else {
      r = bg[0] + (fg[0] - bg[0]) * t
      gg = bg[1] + (fg[1] - bg[1]) * t
      b = bg[2] + (fg[2] - bg[2]) * t
    }
    out[i * 4] = Math.round(r)
    out[i * 4 + 1] = Math.round(gg)
    out[i * 4 + 2] = Math.round(b)
    out[i * 4 + 3] = 255
  }
  return out
}

function hexF(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0')
  const int = parseInt(n, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}
