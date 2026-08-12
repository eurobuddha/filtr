import type { Renderer } from '@/engine/renderer'
import { resolveChars } from '@/engine/charsets'
import { downloadBlob, timestamp } from '@/lib/download'
import { useStore } from '@/state/store'

const lum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

/** Render the current image to a monospace ASCII string (matches the on-screen mapping). */
export function buildAsciiText(renderer: Renderer): string {
  const s = useStore.getState().settings.ascii
  const { data, width, height } = renderer.sampleAdjusted()
  const chars = [...resolveChars(s.set, s.customChars)]
  const cellX = Math.max(2, Math.round(s.scale * 4))
  const cellY = cellX * 2 // glyph aspect correction
  const cols = Math.max(1, Math.floor(width / cellX))
  const rows = Math.max(1, Math.floor(height / cellY))
  const lines: string[] = []
  for (let cy = 0; cy < rows; cy++) {
    let line = ''
    for (let cx = 0; cx < cols; cx++) {
      const px = Math.min(width - 1, Math.floor((cx + 0.5) * cellX))
      const py = Math.min(height - 1, Math.floor((cy + 0.5) * cellY))
      const i = (py * width + px) * 4
      let l = Math.pow(Math.min(1, Math.max(0, lum(data[i], data[i + 1], data[i + 2]))), s.brightnessMapping)
      if (s.invert) l = 1 - l
      const idx = Math.min(chars.length - 1, Math.max(0, Math.floor(l * chars.length)))
      line += chars[idx]
    }
    lines.push(line.replace(/\s+$/, ''))
  }
  return lines.join('\n')
}

export function exportAsciiText(renderer: Renderer) {
  const text = buildAsciiText(renderer)
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `filtr-${timestamp()}.txt`)
}

export async function copyAsciiText(renderer: Renderer): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(buildAsciiText(renderer))
    return true
  } catch {
    return false
  }
}
