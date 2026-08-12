import type { SourceKind } from '@/state/types'
import { decompressFrames, parseGIF } from 'gifuct-js'

interface GifFrame {
  canvas: HTMLCanvasElement
  delay: number // ms
}

/**
 * Unified input that always exposes a single WebGL texture plus dimensions.
 * `update(now)` re-uploads the current frame for time-based media and returns
 * whether the texture content changed since the last call.
 */
export class InputSource {
  kind: SourceKind = 'none'
  width = 0
  height = 0
  texture: WebGLTexture
  name: string | null = null

  private gl: WebGL2RenderingContext
  private video: HTMLVideoElement | null = null
  private stream: MediaStream | null = null
  private gifFrames: GifFrame[] = []
  private gifTotal = 0
  private gifCumulative: number[] = []
  private gifIndex = -1
  private startTime = 0
  private gifPaused = false
  private gifPausedAt = 0
  private needsUpload = false

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    // 1×1 placeholder so sampling is always valid
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([20, 20, 20, 255]),
    )
  }

  get isTimeBased() {
    return this.kind === 'video' || this.kind === 'webcam' || this.kind === 'gif'
  }

  get isPlaying() {
    if (this.kind === 'video' || this.kind === 'webcam')
      return !!this.video && !this.video.paused
    if (this.kind === 'gif') return !this.gifPaused
    return false
  }

  get duration() {
    if (this.video) return this.video.duration || 0
    if (this.kind === 'gif') return this.gifTotal / 1000
    return 0
  }

  get currentTime() {
    if (this.video) return this.video.currentTime
    return 0
  }

  get frameCount() {
    return this.gifFrames.length
  }

  // ── loaders ────────────────────────────────────────────────────────────
  async loadImage(file: File | Blob, name?: string) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    this.reset()
    this.kind = 'image'
    this.width = bitmap.width
    this.height = bitmap.height
    this.name = name ?? (file instanceof File ? file.name : null)
    this.uploadSource(bitmap)
    bitmap.close()
    this.needsUpload = false
  }

  async loadVideo(file: File) {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.src = url
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve()
        video.onerror = () => reject(new Error('Failed to load video'))
      })
    } catch (e) {
      // clean up the partial resource without disturbing the current source
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
      throw e
    }
    this.reset()
    this.kind = 'video'
    this.video = video
    this.width = video.videoWidth
    this.height = video.videoHeight
    this.name = file.name
    await video.play().catch(() => {})
  }

  async startWebcam() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    })
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    try {
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve()
      })
      await video.play()
    } catch (e) {
      // release the camera if we couldn't start playback
      stream.getTracks().forEach((t) => t.stop())
      video.srcObject = null
      throw e
    }
    this.reset()
    this.kind = 'webcam'
    this.video = video
    this.stream = stream
    this.width = video.videoWidth
    this.height = video.videoHeight
    this.name = 'Webcam'
  }

  async loadGif(file: File) {
    const buf = await file.arrayBuffer()
    const gif = parseGIF(buf)
    const frames = decompressFrames(gif, true)
    if (!frames.length) throw new Error('Failed to decode animated GIF')

    const W = gif.lsd.width
    const H = gif.lsd.height
    // Composite each frame respecting disposal so seeking is O(1).
    const composite = document.createElement('canvas')
    composite.width = W
    composite.height = H
    const cctx = composite.getContext('2d')!
    const patchCanvas = document.createElement('canvas')
    const pctx = patchCanvas.getContext('2d')!

    const out: GifFrame[] = []
    let total = 0
    let prevImageData: ImageData | null = null

    for (const frame of frames) {
      const { dims, disposalType, delay } = frame
      if (disposalType === 3) prevImageData = cctx.getImageData(0, 0, W, H)

      patchCanvas.width = dims.width
      patchCanvas.height = dims.height
      const imgData = pctx.createImageData(dims.width, dims.height)
      imgData.data.set(frame.patch)
      pctx.putImageData(imgData, 0, 0)
      cctx.drawImage(patchCanvas, dims.left, dims.top)

      const snapshot = document.createElement('canvas')
      snapshot.width = W
      snapshot.height = H
      snapshot.getContext('2d')!.drawImage(composite, 0, 0)
      const d = Math.max(20, delay || 100)
      out.push({ canvas: snapshot, delay: d })
      total += d

      if (disposalType === 2) cctx.clearRect(dims.left, dims.top, dims.width, dims.height)
      else if (disposalType === 3 && prevImageData) cctx.putImageData(prevImageData, 0, 0)
    }

    this.reset()
    this.kind = 'gif'
    this.width = W
    this.height = H
    this.name = file.name
    this.gifFrames = out
    this.gifTotal = total
    this.gifCumulative = []
    let acc = 0
    for (const f of out) {
      acc += f.delay
      this.gifCumulative.push(acc)
    }
    this.gifIndex = -1
    this.gifPaused = false
  }

  // ── per-frame update ─────────────────────────────────────────────────
  update(now: number): boolean {
    if (this.kind === 'video' || this.kind === 'webcam') {
      if (this.video && this.video.readyState >= 2 && !this.video.paused) {
        this.uploadSource(this.video)
        return true
      }
      if (this.needsUpload && this.video) {
        this.uploadSource(this.video)
        this.needsUpload = false
        return true
      }
      return false
    }
    if (this.kind === 'gif' && this.gifFrames.length) {
      if (this.startTime === 0) this.startTime = now
      const elapsed = this.gifPaused
        ? this.gifPausedAt
        : (now - this.startTime) % this.gifTotal
      let idx = 0
      while (idx < this.gifCumulative.length - 1 && elapsed >= this.gifCumulative[idx])
        idx++
      if (idx !== this.gifIndex || this.needsUpload) {
        this.gifIndex = idx
        this.uploadSource(this.gifFrames[idx].canvas)
        this.needsUpload = false
        return true
      }
      return false
    }
    return false
  }

  // ── playback controls (video + gif) ────────────────────────────────────
  play() {
    if (this.video) this.video.play().catch(() => {})
    if (this.kind === 'gif' && this.gifPaused) {
      this.gifPaused = false
      // resume in place: shift startTime so elapsed continues from gifPausedAt
      this.startTime = performance.now() - this.gifPausedAt
      this.needsUpload = true
    }
  }
  pause() {
    if (this.video) {
      this.video.pause()
      this.needsUpload = true
    }
    if (this.kind === 'gif' && !this.gifPaused) {
      // freeze at the current frame instead of snapping back to 0
      this.gifPausedAt =
        this.gifTotal > 0 && this.startTime > 0
          ? (performance.now() - this.startTime) % this.gifTotal
          : 0
      this.gifPaused = true
    }
  }
  togglePlay() {
    this.isPlaying ? this.pause() : this.play()
  }
  seek(t: number) {
    if (this.video) {
      this.video.currentTime = t
      this.needsUpload = true
    }
  }

  private uploadSource(src: TexImageSource) {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    // No FLIP_Y: the pipeline renders through intermediate FBOs and the final
    // composite samples v_uv directly, so the source must keep its native
    // (row 0 = top) orientation to end up upright on the canvas.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
  }

  private reset() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }
    if (this.video) {
      this.video.pause()
      if (this.video.src) URL.revokeObjectURL(this.video.src)
      this.video.removeAttribute('src')
      this.video.srcObject = null
      this.video = null
    }
    this.gifFrames = []
    this.gifCumulative = []
    this.gifTotal = 0
    this.gifIndex = -1
    this.startTime = 0
    this.gifPaused = false
    this.gifPausedAt = 0
    this.needsUpload = false
  }

  dispose() {
    this.reset()
    this.gl.deleteTexture(this.texture)
  }
}
