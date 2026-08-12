// Full-page screenshot of the app UI (chrome + panels), with a source loaded.
import { chromium } from 'playwright'

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('  EXC:', e.message))
await page.goto('http://localhost:5173', { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__filtrLoadFile, { timeout: 20000 })
await page.screenshot({ path: '/tmp/filtr-page-empty.png' })
await page.evaluate(async () => {
  const c = document.createElement('canvas')
  c.width = 720; c.height = 540
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, 720, 540)
  g.addColorStop(0, '#ff5a36'); g.addColorStop(0.5, '#34d6e0'); g.addColorStop(1, '#0a0a0a')
  x.fillStyle = g; x.fillRect(0, 0, 720, 540)
  x.fillStyle = '#fff'; x.beginPath(); x.arc(220, 200, 100, 0, 7); x.fill()
  x.fillStyle = '#000'; x.beginPath(); x.arc(500, 340, 80, 0, 7); x.fill()
  x.fillStyle = '#ffd23f'; x.fillRect(340, 70, 130, 130)
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
  await window.__filtrLoadFile(new File([blob], 'demo.png', { type: 'image/png' }))
})
await page.waitForTimeout(900)
await page.screenshot({ path: '/tmp/filtr-page-loaded.png' })
// open the post-processing panel to show controls
await page.getByText('Post-processing').click().catch(() => {})
await page.getByText('Adjustments').first().click().catch(() => {})
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/filtr-page-panels.png' })
console.log('done')
await browser.close()
