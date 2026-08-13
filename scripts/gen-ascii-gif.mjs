// Renders the ASCII launch GIF. Separate from gen-launch-gifs.mjs because this
// shot needs two things the others don't:
//
//   1. Its own source. The stock demo is a dark sunset — most of the frame is
//      shadow, and ASCII needs a full tonal ramp and one clear subject or it
//      reads as a black rectangle in a feed thumbnail.
//   2. Motion. ASCII on a still image is a still image, so the cell size is
//      driven from coarse to fine during capture and the art resolves. The GIF
//      exporter reads the live canvas, so this lands exactly as a user sees it.
//
// The source is drawn in-page rather than committed, so nothing extra ships in
// the deployed bundle.
//
//   npm run dev &
//   node scripts/gen-ascii-gif.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'

const URL = process.env.FILTR_URL || 'http://localhost:5173'
const OUT = process.env.OUT_DIR || '/tmp/filtr-launch'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true })
page.on('pageerror', (e) => console.log('  EXC', e.message))
await page.goto(URL, { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__filtrStore && !!window.__filtrLoadFile, { timeout: 20000 })

// Source: one large subject with a hard key light, so the glyph ramp has the
// full range from specular highlight to core shadow. Flat bars on the right
// give three unambiguous densities to read the ramp against.
await page.evaluate(async () => {
  const W = 1400, H = 933
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d')
  const bg = x.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#f4f2ec'); bg.addColorStop(0.62, '#b9b4a8'); bg.addColorStop(1, '#4a463e')
  x.fillStyle = bg; x.fillRect(0, 0, W, H)

  const cx = W * 0.46, cy = H * 0.5, r = H * 0.3
  const sh = x.createRadialGradient(cx, H * 0.855, r * 0.1, cx, H * 0.855, r * 1.5)
  sh.addColorStop(0, 'rgba(20,18,15,0.55)'); sh.addColorStop(1, 'rgba(20,18,15,0)')
  x.fillStyle = sh
  x.beginPath(); x.ellipse(cx, H * 0.855, r * 1.35, r * 0.2, 0, 0, Math.PI * 2); x.fill()

  const g = x.createRadialGradient(cx - r * 0.42, cy - r * 0.46, r * 0.04, cx, cy, r * 1.12)
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.14, '#f2efe6'); g.addColorStop(0.38, '#c2bcae')
  g.addColorStop(0.62, '#7d786c'); g.addColorStop(0.85, '#38352e'); g.addColorStop(1, '#191712')
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill()

  const bounce = x.createRadialGradient(cx + r * 0.55, cy + r * 0.6, r * 0.02, cx + r * 0.5, cy + r * 0.55, r * 0.75)
  bounce.addColorStop(0, 'rgba(230,225,212,0.4)'); bounce.addColorStop(1, 'rgba(230,225,212,0)')
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip()
  x.fillStyle = bounce; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.restore()

  ;['#efece3', '#9c978a', '#2b2822'].forEach((col, i) => {
    x.fillStyle = col; x.fillRect(W * 0.79, H * 0.2 + i * H * 0.2, W * 0.14, H * 0.16)
  })

  const blob = await new Promise((res) => c.toBlob(res, 'image/png'))
  await window.__filtrLoadFile(new File([blob], 'ascii-source.png', { type: 'image/png' }))
})
await page.waitForTimeout(1200)

const OFF = { bloom: { enabled: false }, scanlines: { enabled: false }, grain: { enabled: false },
  crtCurve: { enabled: false }, vignette: { enabled: false }, phosphor: { enabled: false }, chromatic: { enabled: false } }

// maxPreviewDim 1080 makes the canvas exactly 1080 wide, so the GIF encoder
// does no downscaling and the glyphs keep their rendered size.
await page.evaluate((x) => window.__filtrStore.getState().applyPreset(x), {
  active: 'ascii',
  ascii: { backgroundColor: '#f4f2ec', custom: '#14130f', colorMode: 'mono', invert: true,
           brightness: 0, contrast: 28, scale: 9, intensity: 1.5, brightnessMapping: 1, set: 'standard' },
  post: OFF,
  output: { background: '#f4f2ec', maxPreviewDim: 1080 },
})
await page.waitForTimeout(700)

const panel = page.locator('section').filter({ has: page.getByRole('button', { name: /\.gif/ }) })
await panel.getByRole('button', { name: /\.gif/ }).click()
await page.waitForTimeout(300)
const sliders = panel.locator('input[type=range]')
await sliders.nth(0).fill('4')   // 4s
await sliders.nth(1).fill('14')  // 14fps
await panel.getByRole('button', { name: '1080', exact: true }).click()
await page.waitForTimeout(300)

const animate = page.evaluate(async () => {
  const s = window.__filtrStore.getState()
  const from = 9, to = 3, ms = 3400, t0 = performance.now()
  await new Promise((done) => {
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      s.setPath('ascii.scale', from + (to - from) * e)
      k < 1 ? requestAnimationFrame(tick) : done()
    }
    tick()
  })
})

const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 120000 }),
  panel.getByRole('button', { name: /Export gif/i }).click(),
  animate,
])
const dest = `${OUT}/ascii.gif`
fs.copyFileSync(await dl.path(), dest)
console.log(`  ascii.gif  ${(fs.statSync(dest).size / 1024).toFixed(0)} KB`)
await browser.close()
console.log('done →', OUT)
