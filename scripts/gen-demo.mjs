// Generates public/demo.png — the sample auto-loaded when someone arrives via
// a deep link (?fx=, ?p= or #s=), so they land on a rendered image instead of
// the empty drop zone. Run: node scripts/gen-demo.mjs
//
// Synthetic on purpose: no licensing questions, and it is built to exercise the
// effects — a broad tonal ramp for dithering, hard edges for edge detection,
// fine detail for ASCII cell sampling, and saturated colour for palettes.
import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = new URL('../public/demo.png', import.meta.url).pathname
const W = 1400
const H = 933

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H } })

const dataUrl = await page.evaluate(
  ({ W, H }) => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const x = c.getContext('2d')

    // Sky: smooth vertical ramp — the hardest thing for a ditherer, so it shows
    // banding vs error diffusion clearly.
    const sky = x.createLinearGradient(0, 0, 0, H * 0.72)
    sky.addColorStop(0, '#0b1d3a')
    sky.addColorStop(0.45, '#7b3f6d')
    sky.addColorStop(0.78, '#e8663a')
    sky.addColorStop(1, '#ffc24a')
    x.fillStyle = sky
    x.fillRect(0, 0, W, H * 0.72)

    // Sun: a hard-edged disc for edge detection and halftone dots.
    x.fillStyle = '#fff4d6'
    x.beginPath()
    x.arc(W * 0.68, H * 0.34, H * 0.11, 0, Math.PI * 2)
    x.fill()

    // Layered ridges, back to front, darkening — broad flat tonal steps.
    const ridges = [
      { y: 0.56, amp: 0.05, fill: '#3d2a54' },
      { y: 0.64, amp: 0.07, fill: '#2a1c3d' },
      { y: 0.73, amp: 0.05, fill: '#181026' },
    ]
    for (const [i, r] of ridges.entries()) {
      x.fillStyle = r.fill
      x.beginPath()
      x.moveTo(0, H)
      x.lineTo(0, H * r.y)
      for (let px = 0; px <= W; px += 8) {
        const t = px / W
        const yy =
          H * r.y +
          Math.sin(t * Math.PI * (2.5 + i)) * H * r.amp +
          Math.sin(t * Math.PI * (7 + i * 3)) * H * r.amp * 0.35
        x.lineTo(px, yy)
      }
      x.lineTo(W, H)
      x.closePath()
      x.fill()
    }

    // Foreground: near-black with a water band reflecting the sky.
    const water = x.createLinearGradient(0, H * 0.78, 0, H)
    water.addColorStop(0, '#1b1230')
    water.addColorStop(1, '#050409')
    x.fillStyle = water
    x.fillRect(0, H * 0.78, W, H * 0.22)
    x.globalAlpha = 0.22
    x.fillStyle = '#e8663a'
    for (let i = 0; i < 42; i++) {
      const yy = H * 0.79 + Math.random() * H * 0.19
      const w = 40 + Math.random() * 260
      x.fillRect(W * 0.68 - w / 2 + (Math.random() - 0.5) * 120, yy, w, 1.5)
    }
    x.globalAlpha = 1

    // Fine detail: a few birds, so ASCII/halftone have small features to resolve.
    x.strokeStyle = '#120b1e'
    x.lineWidth = 2.5
    for (const [bx, by, s] of [
      [0.24, 0.2, 1],
      [0.3, 0.26, 0.75],
      [0.19, 0.29, 0.6],
    ]) {
      const px = W * bx
      const py = H * by
      const r = 16 * s
      x.beginPath()
      x.moveTo(px - r, py)
      x.quadraticCurveTo(px - r / 2, py - r / 2, px, py)
      x.quadraticCurveTo(px + r / 2, py - r / 2, px + r, py)
      x.stroke()
    }

    return c.toDataURL('image/png')
  },
  { W, H },
)

fs.writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'))
await browser.close()
console.log('wrote', OUT, `${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`)
