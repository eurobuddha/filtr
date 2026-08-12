// Generate PNG app icons + social preview from the filtr mark, via canvas.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PUB = path.resolve('public')
const browser = await chromium.launch()
const page = await browser.newPage()

async function render(fn, ...args) {
  const dataUrl = await page.evaluate(fn, ...args)
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

function drawIcon(size) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const x = c.getContext('2d')
  const r = size * 0.22
  x.fillStyle = '#ff5a36'
  x.beginPath()
  x.roundRect(0, 0, size, size, r)
  x.fill()
  x.fillStyle = '#0a0a0a'
  x.font = `700 ${size * 0.72}px ui-monospace, monospace`
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText('f', size / 2, size * 0.56)
  return c.toDataURL('image/png')
}

function drawPreview() {
  const W = 1200
  const H = 630
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const x = c.getContext('2d')
  x.fillStyle = '#0a0a0a'
  x.fillRect(0, 0, W, H)
  // halftone-ish dot field
  for (let gy = 0; gy < H; gy += 22) {
    for (let gx = 0; gx < W; gx += 22) {
      const d = Math.hypot(gx - 280, gy - 315) / 520
      const rr = Math.max(0, 4.5 * (1 - d))
      if (rr < 0.4) continue
      x.fillStyle = gx < 560 ? '#ff5a36' : '#222'
      x.globalAlpha = gx < 560 ? 0.5 * (1 - d) : 0.5
      x.beginPath()
      x.arc(gx, gy, rr, 0, 7)
      x.fill()
    }
  }
  x.globalAlpha = 1
  // mark tile
  const s = 150
  const tx = 110
  const ty = H / 2 - s / 2
  x.fillStyle = '#ff5a36'
  x.beginPath()
  x.roundRect(tx, ty, s, s, 30)
  x.fill()
  x.fillStyle = '#0a0a0a'
  x.font = '700 108px ui-monospace, monospace'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText('f', tx + s / 2, ty + s * 0.56)
  // wordmark + tagline
  x.textAlign = 'left'
  x.fillStyle = '#ededed'
  x.font = '700 96px Inter, system-ui, sans-serif'
  x.fillText('filtr', 300, H / 2 - 34)
  x.fillStyle = '#9a9a9a'
  x.font = '400 34px Inter, system-ui, sans-serif'
  x.fillText('ASCII · dithering · halftone · retro effects', 304, H / 2 + 38)
  x.fillStyle = '#34d6e0'
  x.font = '600 22px ui-monospace, monospace'
  x.fillText('REAL-TIME · WEBGL2 · FREE', 304, H / 2 + 86)
  return c.toDataURL('image/png')
}

fs.writeFileSync(path.join(PUB, 'icon-192.png'), await render(drawIcon, 192))
fs.writeFileSync(path.join(PUB, 'icon-512.png'), await render(drawIcon, 512))
fs.writeFileSync(path.join(PUB, 'apple-touch-icon.png'), await render(drawIcon, 180))
fs.writeFileSync(path.join(PUB, 'preview.png'), await render(drawPreview))
console.log('icons written to', PUB)
await browser.close()
