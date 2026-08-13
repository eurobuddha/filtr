// Builds the README media: a contact sheet of eight effects on one source.
// A grid of stills communicates breadth in ~200 KB, where eight GIFs would be
// 39 MB and bloat every clone of the repo.
//
//   npm run dev &
//   node scripts/gen-readme-media.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'

const URL = process.env.FILTR_URL || 'http://localhost:5173'
const OUT = 'docs/media'
fs.mkdirSync(OUT, { recursive: true })

const CELLS = [
  { label: 'ASCII', preset: 'classic-terminal' },
  { label: 'Dithering', preset: 'gameboy' },
  { label: 'Halftone', preset: 'newsprint' },
  { label: 'Risograph', preset: 'risograph' },
  { label: 'Matrix Rain', preset: 'matrix-rain' },
  { label: 'Pixel Sort', preset: 'glitch-sort' },
  { label: 'VHS', preset: 'vhs-tape' },
  { label: 'Contour', preset: 'topographic' },
]

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
page.on('pageerror', (e) => console.log('  EXC', e.message))
await page.goto(URL, { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__filtrStore && !!window.__filtrLoadFile, { timeout: 20000 })
await page.evaluate(async () => {
  const r = await fetch('/demo.png')
  await window.__filtrLoadFile(new File([await r.blob()], 'demo.png', { type: 'image/png' }))
})
await page.waitForTimeout(1200)

// Render each cell to a data URL at a consistent size.
const shots = []
for (const cell of CELLS) {
  await page.evaluate(async (id) => {
    const m = await import('/src/state/presets.ts')
    const p = m.BUILTIN_PRESETS.find((x) => x.id === id)
    if (p) window.__filtrStore.getState().applyPreset(p.settings)
    window.__filtrStore.getState().setPath('output.maxPreviewDim', 640)
  }, cell.preset)
  await page.waitForTimeout(900)
  shots.push(await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png')))
  console.log('  rendered', cell.label)
}

// Compose the grid in-page so there is no image dependency in the toolchain.
const sheet = await page.evaluate(async ({ shots, labels }) => {
  const COLS = 4, CW = 480, CH = 320, PAD = 8, LABEL = 26
  const rows = Math.ceil(shots.length / COLS)
  const c = document.createElement('canvas')
  c.width = COLS * CW + PAD * (COLS + 1)
  c.height = rows * (CH + LABEL) + PAD * (rows + 1)
  const x = c.getContext('2d')
  x.fillStyle = '#0a0a0a'
  x.fillRect(0, 0, c.width, c.height)

  for (let i = 0; i < shots.length; i++) {
    const img = new Image()
    await new Promise((r) => { img.onload = r; img.src = shots[i] })
    const col = i % COLS, row = Math.floor(i / COLS)
    const dx = PAD + col * (CW + PAD)
    const dy = PAD + row * (CH + LABEL + PAD)
    // cover-fit into the cell
    const s = Math.max(CW / img.width, CH / img.height)
    const sw = CW / s, sh = CH / s
    x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, dx, dy, CW, CH)
    x.fillStyle = '#6c6c6c'
    x.font = '500 15px ui-monospace, "SF Mono", Menlo, monospace'
    x.textBaseline = 'middle'
    x.fillText(labels[i].toUpperCase(), dx + 2, dy + CH + LABEL / 2 + 1)
  }
  return c.toDataURL('image/png')
}, { shots, labels: CELLS.map((c) => c.label) })

fs.writeFileSync(`${OUT}/effects.png`, Buffer.from(sheet.split(',')[1], 'base64'))
console.log(`\n  ${OUT}/effects.png  ${(fs.statSync(`${OUT}/effects.png`).size / 1024).toFixed(0)} KB`)
await browser.close()
