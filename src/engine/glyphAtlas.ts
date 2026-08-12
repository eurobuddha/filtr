// Builds a horizontal glyph-atlas strip (one cell per character) on a 2D canvas.
// The ASCII shader samples a sub-cell of this strip per output cell.

export interface GlyphAtlas {
  canvas: HTMLCanvasElement
  count: number
  glyphPx: number
}

export function buildGlyphAtlas(chars: string, glyphPx = 48): GlyphAtlas {
  const list = [...chars] // handle multi-byte unicode glyphs
  const count = Math.max(1, list.length)
  const canvas = document.createElement('canvas')
  canvas.width = glyphPx * count
  canvas.height = glyphPx
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#fff'
  ctx.font = `${Math.round(glyphPx * 0.82)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < count; i++) {
    const cx = i * glyphPx + glyphPx / 2
    ctx.fillText(list[i], cx, glyphPx / 2 + glyphPx * 0.02)
  }

  return { canvas, count, glyphPx }
}
