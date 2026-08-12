// Visual harness: load a test image, screenshot the canvas for all 15 effects,
// plus a full-page UI shot. Output to /tmp/filtr-shots.
import { chromium } from 'playwright'
import fs from 'node:fs'

const URL = process.env.FILTR_URL || 'http://localhost:5173'
const OUT = '/tmp/filtr-shots'
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const EFFECTS = ['ascii', 'dithering', 'halftone', 'matrixRain', 'contour', 'pixelSort', 'dots', 'edgeDetection', 'crosshatch', 'blockify', 'threshold', 'noiseField', 'waveLines', 'voronoi', 'vhs']

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1512, height: 950 }, deviceScaleFactor: 1 })
page.on('console', (m) => m.type() === 'error' && console.log('  ERR', m.text()))
page.on('pageerror', (e) => console.log('  EXC', e.message))
await page.goto(URL, { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__filtrLoadFile && !!window.__filtrStore, { timeout: 20000 })

await page.evaluate(async () => {
  const c = document.createElement('canvas')
  c.width = 800; c.height = 600
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, 800, 600)
  g.addColorStop(0, '#ff5a36'); g.addColorStop(0.5, '#34d6e0'); g.addColorStop(1, '#0a0a0a')
  x.fillStyle = g; x.fillRect(0, 0, 800, 600)
  x.fillStyle = '#fff'; x.beginPath(); x.arc(240, 220, 110, 0, 7); x.fill()
  x.fillStyle = '#000'; x.beginPath(); x.arc(560, 380, 90, 0, 7); x.fill()
  x.fillStyle = '#ffd23f'; x.fillRect(380, 80, 140, 140)
  x.fillStyle = '#fff'; x.font = 'bold 80px sans-serif'; x.fillText('filtr', 80, 540)
  x.fillStyle = '#ffffff'; x.fillRect(14, 14, 70, 70)
  x.fillStyle = '#ff00ff'; x.fillRect(716, 14, 70, 70)
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
  await window.__filtrLoadFile(new File([blob], 'test.png', { type: 'image/png' }))
})
await page.waitForTimeout(900)

const canvas = page.locator('canvas')
let i = 0
for (const fx of EFFECTS) {
  await page.evaluate((id) => window.__filtrStore.getState().setPath('active', id), fx)
  await page.waitForTimeout(700)
  const name = `${String(i++).padStart(2, '0')}-${fx}.png`
  await canvas.screenshot({ path: `${OUT}/${name}` })
  console.log('  shot', name)
}

// full-page UI (ascii active)
await page.evaluate(() => window.__filtrStore.getState().setPath('active', 'ascii'))
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/_page.png` })
console.log('  shot _page.png')

// UI chrome in both themes. data-theme is pure DOM (see src/state/theme.ts), so
// writing it directly bypasses localStorage/matchMedia and is deterministic.
// The paired canvas shots must be IDENTICAL across themes — that is the proof
// the theme never reaches the render pipeline.
for (const theme of ['dark', 'light']) {
  await page.evaluate((v) => { document.documentElement.dataset.theme = v }, theme)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/_page-${theme}.png` })
  await canvas.screenshot({ path: `${OUT}/_canvas-${theme}.png` })
  console.log('  shot _page-' + theme + '.png')
}
await browser.close()
console.log('done →', OUT)
