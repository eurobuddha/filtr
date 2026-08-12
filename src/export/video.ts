import type { Renderer } from '@/engine/renderer'
import { downloadBlob, timestamp } from '@/lib/download'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function pickMime(): string {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  }
  return 'video/webm'
}

export interface VideoOptions {
  seconds?: number
  fps?: number
  onProgress?: (t: number) => void
}

/**
 * Record the live canvas via MediaRecorder. Produces MP4 where the browser
 * supports it (Safari), otherwise WebM. Captures whatever is animating.
 */
export async function recordVideo(renderer: Renderer, opts: VideoOptions = {}) {
  const { seconds = 5, fps = 30, onProgress } = opts
  const canvas = renderer.gl.canvas as HTMLCanvasElement
  const stream = canvas.captureStream(fps)
  const mime = pickMime()
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
  const chunks: BlobPart[] = []
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  const stopped = new Promise<void>((resolve) => {
    rec.onstop = () => resolve()
  })

  rec.start()
  const start = performance.now()
  const tick = () => {
    const t = (performance.now() - start) / (seconds * 1000)
    onProgress?.(Math.min(1, t))
  }
  const id = setInterval(tick, 100)
  await sleep(seconds * 1000)
  clearInterval(id)
  rec.stop()
  await stopped

  const blob = new Blob(chunks, { type: mime })
  const ext = mime.includes('mp4') ? 'mp4' : 'webm'
  downloadBlob(blob, `filtr-${timestamp()}.${ext}`)
}

/** Whether canvas recording is available in this browser. */
export function videoSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    'captureStream' in HTMLCanvasElement.prototype
  )
}
