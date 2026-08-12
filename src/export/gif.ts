import { applyPalette, GIFEncoder, quantize } from 'gifenc'
import type { Renderer } from '@/engine/renderer'
import { downloadBlob, timestamp } from '@/lib/download'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface GifOptions {
  seconds?: number
  fps?: number
  maxDim?: number
  onProgress?: (t: number) => void
}

/**
 * Capture the live canvas in real time into an animated GIF. Works for any
 * animated source (video, GIF, webcam, matrix/scanlines/grain), and produces a
 * single still frame for static images.
 */
export async function exportGif(renderer: Renderer, opts: GifOptions = {}) {
  const { seconds = 3, fps = 12, maxDim = 480, onProgress } = opts
  const canvas = renderer.gl.canvas as HTMLCanvasElement
  const srcW = canvas.width
  const srcH = canvas.height
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))

  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const ctx = tmp.getContext('2d', { willReadFrequently: true })!

  const enc = GIFEncoder()
  const frames = Math.max(1, Math.round(seconds * fps))
  const interval = 1000 / fps

  // drive frames deterministically: stop the live loop and step time ourselves
  renderer.stop()
  try {
    for (let f = 0; f < frames; f++) {
      // pump the source (the live loop is stopped) so video/GIF frames advance
      renderer.source.update(performance.now())
      renderer.renderNow()
      ctx.drawImage(canvas, 0, 0, w, h)
      const { data } = ctx.getImageData(0, 0, w, h)
      const palette = quantize(data, 256)
      const index = applyPalette(data, palette)
      enc.writeFrame(index, w, h, { palette, delay: Math.round(interval) })
      onProgress?.((f + 1) / frames)
      if (f < frames - 1) await sleep(interval)
    }
  } finally {
    renderer.start()
  }

  enc.finish()
  const bytes = new Uint8Array(enc.bytesView()) // copy into an ArrayBuffer-backed view
  downloadBlob(new Blob([bytes], { type: 'image/gif' }), `filtr-${timestamp()}.gif`)
}
