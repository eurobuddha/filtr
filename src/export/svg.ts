import type { Renderer } from '@/engine/renderer'
import { resolveChars } from '@/engine/charsets'
import { downloadBlob, timestamp } from '@/lib/download'
import { useStore } from '@/state/store'

const lum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
const esc = (c: string) => c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function svgSupported(active: string): boolean {
  return active === 'ascii' || active === 'halftone'
}

function asciiSvg(renderer: Renderer): string {
  const s = useStore.getState().settings.ascii
  const { data, width, height } = renderer.sampleAdjusted()
  const chars = [...resolveChars(s.set, s.customChars)]
  const cell = Math.max(3, Math.round(s.scale * 4))
  const cols = Math.floor(width / cell)
  const rows = Math.floor(height / cell)
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${s.backgroundColor}"/>`,
    `<g font-family="monospace" font-size="${cell}" text-anchor="middle" dominant-baseline="central">`,
  ]
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) {
      const px = Math.min(width - 1, Math.floor((cx + 0.5) * cell))
      const py = Math.min(height - 1, Math.floor((cy + 0.5) * cell))
      const i = (py * width + px) * 4
      let l = Math.pow(Math.min(1, Math.max(0, lum(data[i], data[i + 1], data[i + 2]))), s.brightnessMapping)
      if (s.invert) l = 1 - l
      const ch = chars[Math.min(chars.length - 1, Math.max(0, Math.floor(l * chars.length)))]
      if (ch === ' ' || ch === undefined) continue
      const color = s.colorMode === 'original' ? hex(data[i], data[i + 1], data[i + 2]) : s.custom
      parts.push(`<text x="${px}" y="${py}" fill="${color}">${esc(ch)}</text>`)
    }
  parts.push('</g></svg>')
  return parts.join('')
}

function halftoneSvg(renderer: Renderer): string {
  const s = useStore.getState().settings.halftone
  const { data, width, height } = renderer.sampleAdjusted()
  const cell = Math.max(3, Math.round(s.spacing))
  const cols = Math.ceil(width / cell)
  const rows = Math.ceil(height / cell)
  const maxR = 0.5 * cell * 1.45 * s.dotScale
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${s.bgColor}"/>`,
    `<g transform="rotate(${s.angle} ${width / 2} ${height / 2})">`,
  ]
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) {
      const x = (cx + 0.5) * cell
      const y = (cy + 0.5) * cell
      const px = Math.min(width - 1, Math.max(0, Math.floor(x)))
      const py = Math.min(height - 1, Math.max(0, Math.floor(y)))
      const i = (py * width + px) * 4
      let ink = 1 - lum(data[i], data[i + 1], data[i + 2])
      if (s.invert) ink = 1 - ink
      const r = Math.sqrt(Math.max(0, ink)) * maxR
      if (r < 0.3) continue
      const color = s.colorMode === 'bw' ? s.fgColor : hex(data[i], data[i + 1], data[i + 2])
      if (s.shape === 'square')
        parts.push(`<rect x="${(x - r).toFixed(1)}" y="${(y - r).toFixed(1)}" width="${(r * 2).toFixed(1)}" height="${(r * 2).toFixed(1)}" fill="${color}"/>`)
      else if (s.shape === 'diamond')
        parts.push(`<path d="M${x.toFixed(1)} ${(y - r).toFixed(1)}L${(x + r).toFixed(1)} ${y.toFixed(1)}L${x.toFixed(1)} ${(y + r).toFixed(1)}L${(x - r).toFixed(1)} ${y.toFixed(1)}Z" fill="${color}"/>`)
      else
        parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}"/>`)
    }
  parts.push('</g></svg>')
  return parts.join('')
}

export function exportSvg(renderer: Renderer) {
  const active = useStore.getState().settings.active
  const svg = active === 'halftone' ? halftoneSvg(renderer) : asciiSvg(renderer)
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `filtr-${timestamp()}.svg`)
}
