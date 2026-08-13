// Renders a set of launch GIFs from public/demo.png, driving the real export
// path so what you post is exactly what a user would get.
//
//   npm run dev &
//   node scripts/gen-launch-gifs.mjs
//
// Output: /tmp/filtr-launch/
import { chromium } from 'playwright'
import fs from 'node:fs'

const URL = process.env.FILTR_URL || 'http://localhost:5173'
const OUT = process.env.OUT_DIR || '/tmp/filtr-launch'
const SIZE = process.env.GIF_SIZE || '1080'
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
// Only wipe on a full run — a targeted ONLY= re-shoot must not delete the rest.
if (!ONLY) fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

// Animated effects get motion; static ones still make a good looping GIF
// because the post-processing (grain, scanlines) moves.
const SHOTS = [
  { name: 'ascii', preset: 'classic-terminal' },
  { name: 'dithering-gameboy', preset: 'gameboy' },
  { name: 'halftone-newsprint', preset: 'newsprint' },
  { name: 'risograph', preset: 'risograph' },
  { name: 'matrix-rain', preset: 'matrix-rain' },
  { name: 'vhs', preset: 'vhs-tape' },
  { name: 'pixel-sort', preset: 'glitch-sort' },
  { name: 'amber-crt', preset: 'amber-crt' },
]

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true })
page.on('pageerror', (e) => console.log('  EXC', e.message))
await page.goto(URL, { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__filtrStore && !!window.__filtrLoadFile, { timeout: 20000 })

// Load the bundled demo through the real file path.
await page.evaluate(async () => {
  const res = await fetch('/demo.png')
  const blob = await res.blob()
  await window.__filtrLoadFile(new File([blob], 'demo.png', { type: 'image/png' }))
})
await page.waitForTimeout(1200)

const panel = page.locator('section').filter({ has: page.getByRole('button', { name: /\.gif/ }) })
await panel.getByRole('button', { name: /\.gif/ }).click()
await page.waitForTimeout(300)
const sliders = panel.locator('input[type=range]')
await sliders.nth(0).fill('3')  // 3s
await sliders.nth(1).fill('12') // 12fps
await panel.getByRole('button', { name: SIZE, exact: true }).click()
await page.waitForTimeout(300)

for (const shot of SHOTS) {
  if (ONLY && !ONLY.includes(shot.name)) continue
  const applied = await page.evaluate(async (id) => {
    const m = await import('/src/state/presets.ts')
    const p = m.BUILTIN_PRESETS.find((x) => x.id === id)
    if (!p) return false
    window.__filtrStore.getState().applyPreset(p.settings)
    return true
  }, shot.preset)
  if (!applied) { console.log(`  SKIP ${shot.name} — preset "${shot.preset}" not found`); continue }
  await page.waitForTimeout(1000)

  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 120000 }),
    panel.getByRole('button', { name: /Export gif/i }).click(),
  ])
  const dest = `${OUT}/${shot.name}.gif`
  fs.copyFileSync(await dl.path(), dest)
  const kb = (fs.statSync(dest).size / 1024).toFixed(0)
  console.log(`  ${shot.name}.gif  ${kb} KB`)
  await page.waitForTimeout(600)
}

await browser.close()
console.log('\ndone →', OUT)
