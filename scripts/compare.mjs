// Compose original (left) vs filtr (right) into one image for honest review.
import { chromium } from 'playwright'
import fs from 'node:fs'

const browser = await chromium.launch()
const page = await browser.newPage()
const orig = fs.readFileSync('/tmp/original-landing.png').toString('base64')
const ours = fs.readFileSync('/tmp/filtr-shots/_page.png').toString('base64')
await page.setViewportSize({ width: 1600, height: 520 })
await page.setContent(`
<body style="margin:0;background:#000;font-family:monospace">
  <div style="display:flex;gap:2px;background:#333">
    <div style="flex:1">
      <div style="color:#8f8;font-size:12px;padding:4px 8px;background:#111">ORIGINAL — grainrad.com</div>
      <img src="data:image/png;base64,${orig}" style="width:100%;display:block"/>
    </div>
    <div style="flex:1">
      <div style="color:#c6f24e;font-size:12px;padding:4px 8px;background:#111">FILTR — ours</div>
      <img src="data:image/png;base64,${ours}" style="width:100%;display:block"/>
    </div>
  </div>
</body>`)
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/filtr-compare.png', fullPage: true })
await browser.close()
console.log('compare written')
