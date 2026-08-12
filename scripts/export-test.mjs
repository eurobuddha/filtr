import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = '/tmp/filtr-exports'
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1512, height: 950 }, acceptDownloads: true })
page.on('pageerror', (e) => console.log('  EXC:', e.message))
await page.goto('http://localhost:5173', { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__filtrLoadFile && !!window.__filtrStore, { timeout: 20000 })
await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 480; c.height = 360
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, 480, 360); g.addColorStop(0, '#fff'); g.addColorStop(1, '#000')
  x.fillStyle = g; x.fillRect(0, 0, 480, 360)
  x.fillStyle = '#e33'; x.beginPath(); x.arc(160, 140, 70, 0, 7); x.fill()
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
  await window.__filtrLoadFile(new File([blob], 't.png', { type: 'image/png' }))
})
await page.waitForTimeout(600)

const setActive = (id) => page.evaluate((x) => window.__filtrStore.getState().setPath('active', x), id)
async function exportVia(tab, name) {
  await page.getByRole('button', { name: new RegExp(tab) }).first().click()
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.getByRole('button', { name: /^Export/i }).first().click(),
  ])
  const p = `${OUT}/${name}`; await dl.saveAs(p)
  return fs.readFileSync(p)
}

await setActive('ascii')
let b = await exportVia('PNG', 'a.png')
console.log('PNG', b.length, b[0] === 0x89 && b[1] === 0x50 ? 'OK' : 'BAD')
b = await exportVia('Text', 'a.txt')
console.log('TXT', b.length, b.toString().includes('\n') ? 'OK' : 'BAD')
await setActive('halftone')
b = await exportVia('SVG', 'a.svg')
console.log('SVG', b.length, b.toString().startsWith('<svg') ? 'OK' : 'BAD')
await setActive('matrixRain')
b = await exportVia('GIF', 'a.gif')
console.log('GIF', b.length, b.subarray(0, 6).toString('ascii').startsWith('GIF89') ? 'OK' : 'BAD')
await browser.close()
