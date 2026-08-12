// Verify the PRODUCTION build (minified, PWA, no dev hooks) renders by driving
// the real <input type=file>, not the dev test hook.
import { chromium } from 'playwright'

const URL = process.env.FILTR_URL || 'http://localhost:4173'
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push('EXC ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('ERR ' + m.text()))

await page.goto(URL, { waitUntil: 'load' })
await page.waitForTimeout(1500)

// upload a real PNG via the hidden file input (a previous screenshot works)
await page.setInputFiles('input[type=file]', '/tmp/filtr-shots/02-halftone.png')
await page.waitForTimeout(1200)

// switch effects via the real UI (prod has no dev store) to exercise the bundle
for (const fx of ['Halftone', 'Dithering', 'VHS', 'Contour']) {
  await page.getByRole('button', { name: new RegExp(fx) }).first().click()
  await page.waitForTimeout(400)
}
await page.screenshot({ path: '/tmp/filtr-prod.png' })

const canvasInfo = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  return c ? { w: c.width, h: c.height } : null
})
console.log('canvas', JSON.stringify(canvasInfo))
console.log('errors:', errors.length ? errors.join(' | ') : 'none')
await browser.close()
