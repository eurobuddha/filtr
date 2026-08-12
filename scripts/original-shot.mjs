// Screenshot grainrad.com to study its visual design (UI renders even if the
// WebGPU canvas stays blank in headless).
import { chromium } from 'playwright'

const browser = await chromium.launch({
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
})
const page = await browser.newPage({ viewport: { width: 1512, height: 950 }, deviceScaleFactor: 2 })
page.on('pageerror', () => {})
await page.goto('https://grainrad.com/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: '/tmp/original-landing.png' })

// try to reveal controls — many such tools show a panel immediately or after a sample loads
// click any "try"/"sample"/"demo" affordance if present
for (const label of ['Sample', 'Try', 'Demo', 'Example', 'Load']) {
  const b = page.getByRole('button', { name: new RegExp(label, 'i') }).first()
  if (await b.count()) {
    await b.click().catch(() => {})
    break
  }
}
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/original-loaded.png', fullPage: false })

// dump computed fonts/colors of key elements for design matching
const design = await page.evaluate(() => {
  const pick = (el) => {
    if (!el) return null
    const s = getComputedStyle(el)
    return { font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, color: s.color, bg: s.backgroundColor, ls: s.letterSpacing, transform: s.textTransform }
  }
  const body = getComputedStyle(document.body)
  const buttons = [...document.querySelectorAll('button')].slice(0, 6).map(pick)
  const headings = [...document.querySelectorAll('h1,h2,h3')].slice(0, 4).map((h) => ({ ...pick(h), text: h.textContent?.slice(0, 30) }))
  return { bodyBg: body.backgroundColor, bodyColor: body.color, bodyFont: body.fontFamily, buttons, headings }
})
console.log(JSON.stringify(design, null, 2))
await browser.close()
