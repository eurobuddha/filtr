import type { Settings } from '@/state/types'
import { useStore } from '@/state/store'
import { createGL, FullscreenQuad, hexToVec3, Program, type UniformValue } from './gl'
import { PingPong, RenderTarget } from './framebuffer'
import { InputSource } from './source'
import { buildGlyphAtlas } from './glyphAtlas'
import { paletteById } from './palettes'
import { resolveChars } from './charsets'
import { PREP_FRAG } from './shaders/prep'
import * as FX from './shaders/effects'
import {
  BLOOM_FRAG,
  CHROMATIC_FRAG,
  COMPOSITE_FRAG,
  CRT_FRAG,
  GRAIN_FRAG,
  PHOSPHOR_FRAG,
  SCANLINES_FRAG,
  VIGNETTE_FRAG,
} from './shaders/post'
import { computeCpuDither, ditherMethodIndex, isErrorDiffusion } from './cpuDither'

const FRAG: Record<string, string> = {
  prep: PREP_FRAG,
  ascii: FX.ASCII,
  waveLines: FX.WAVELINES,
  dithering: FX.DITHERING,
  halftone: FX.HALFTONE,
  pixelSort: FX.PIXELSORT,
  dots: FX.DOTS,
  contour: FX.CONTOUR,
  edgeDetection: FX.EDGE,
  crosshatch: FX.CROSSHATCH,
  blockify: FX.BLOCKIFY,
  threshold: FX.THRESHOLD,
  noiseField: FX.NOISEFIELD,
  matrixRain: FX.MATRIX,
  vhs: FX.VHS,
  voronoi: FX.VORONOI,
  copy: FX.COPY,
  bloom: BLOOM_FRAG,
  chromatic: CHROMATIC_FRAG,
  scanlines: SCANLINES_FRAG,
  vignette: VIGNETTE_FRAG,
  crt: CRT_FRAG,
  grain: GRAIN_FRAG,
  phosphor: PHOSPHOR_FRAG,
  composite: COMPOSITE_FRAG,
}

const PHOSPHOR_COLORS: Record<string, string> = {
  green: '#33ff66',
  amber: '#ffb000',
  white: '#ffffff',
}

export class Renderer {
  readonly gl: WebGL2RenderingContext
  readonly source: InputSource
  procW = 0
  procH = 0

  private canvas: HTMLCanvasElement
  private quad: FullscreenQuad
  private programs = new Map<string, Program>()
  private pp: PingPong
  private cpuTarget: RenderTarget
  private noiseTex: WebGLTexture
  private atlasTex: WebGLTexture
  private atlasCount = 1
  private atlasKey = ''
  private cpuKey = ''

  private raf = 0
  private running = false
  private lastDirty = -1
  private startTime = 0
  private renderErrored = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.gl = createGL(canvas)
    this.quad = new FullscreenQuad(this.gl)
    this.pp = new PingPong(this.gl)
    this.cpuTarget = new RenderTarget(this.gl)
    this.source = new InputSource(this.gl)
    this.noiseTex = this.makeNoiseTexture(64)
    this.atlasTex = this.gl.createTexture()!
    this.setupTex(this.atlasTex)
  }

  private prog(key: string): Program {
    let p = this.programs.get(key)
    if (!p) {
      p = new Program(this.gl, FRAG[key], undefined, key)
      this.programs.set(key, p)
    }
    return p
  }

  private setupTex(tex: WebGLTexture, filter: number = this.gl.LINEAR) {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
  }

  private makeNoiseTexture(n: number): WebGLTexture {
    const rnd = new Float32Array(n * n)
    for (let i = 0; i < n * n; i++) rnd[i] = Math.random()
    const out = new Uint8Array(n * n)
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        let blur = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            blur += rnd[((y + dy + n) % n) * n + ((x + dx + n) % n)]
        blur /= 9
        out[y * n + x] = Math.max(0, Math.min(255, Math.round((0.5 + (rnd[y * n + x] - blur) * 1.8) * 255)))
      }
    const gl = this.gl
    const tex = gl.createTexture()!
    this.setupTex(tex, gl.NEAREST)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, n, n, 0, gl.RED, gl.UNSIGNED_BYTE, out)
    return tex
  }

  private ensureAtlas(s: Settings) {
    let chars = ''
    if (s.active === 'ascii') chars = resolveChars(s.ascii.set, s.ascii.customChars)
    else if (s.active === 'matrixRain')
      chars = resolveChars(s.matrixRain.characterSet, s.matrixRain.customChars)
    else return
    if (chars === this.atlasKey) return
    this.atlasKey = chars
    const atlas = buildGlyphAtlas(chars)
    this.atlasCount = atlas.count
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas)
  }

  private computeSize(s: Settings) {
    const sw = this.source.width || 1280
    const sh = this.source.height || 720
    const cap = Math.max(256, s.output.maxPreviewDim)
    const longest = Math.max(sw, sh)
    const k = longest > cap ? cap / longest : 1
    this.procW = Math.max(1, Math.round(sw * k))
    this.procH = Math.max(1, Math.round(sh * k))
  }

  private tex(t: WebGLTexture, unit: number): UniformValue {
    return { texture: t, unit }
  }

  private pass(key: string, uniforms: Record<string, UniformValue>, inputTex?: WebGLTexture) {
    this.pp.write.bind()
    const p = this.prog(key).use()
    p.set({ u_tex: this.tex(inputTex ?? this.pp.read.texture, 0), ...uniforms })
    this.quad.draw()
    this.pp.swap()
  }

  private res(): [number, number] {
    return [this.procW, this.procH]
  }

  private paletteColors(name: string): { arr: Float32Array; count: number } {
    const colors = paletteById(name as never)?.colors ?? ['#000000', '#ffffff']
    const count = Math.max(2, Math.min(8, colors.length))
    const arr = new Float32Array(8 * 3)
    for (let i = 0; i < 8; i++) {
      const [r, g, b] = hexToVec3(colors[Math.min(i, colors.length - 1)] ?? '#000000')
      arr[i * 3] = r
      arr[i * 3 + 1] = g
      arr[i * 3 + 2] = b
    }
    return { arr, count }
  }

  // ── effect dispatch ────────────────────────────────────────────────────
  private runEffect(s: Settings, t: number, input: WebGLTexture) {
    const res = this.res()
    const a = s.active
    switch (a) {
      case 'ascii': {
        const p = s.ascii
        let cell = Math.max(2, p.scale * 4)
        if (p.outputWidth > 0) cell = Math.max(2, this.procW / p.outputWidth)
        this.pass('ascii', {
          u_atlas: this.tex(this.atlasTex, 1),
          u_count: this.atlasCount,
          u_cell: cell,
          u_glyph: Math.max(1, cell * (1 - p.spacing * 0.85)),
          u_res: res,
          u_bmap: p.brightnessMapping,
          u_invert: p.invert,
          u_colorMode: p.colorMode === 'mono' ? 0 : 1,
          u_char: hexToVec3(p.custom),
          u_bg: hexToVec3(p.backgroundColor),
          u_intensity: p.intensity,
        }, input)
        break
      }
      case 'waveLines': {
        const p = s.waveLines
        this.pass('waveLines', {
          u_res: res,
          u_lineCount: Math.max(2, p.lineCount),
          u_amplitude: p.amplitude,
          u_frequency: p.frequency,
          u_dir: p.direction === 'vertical' ? 1 : 0,
          u_thickness: p.lineThickness,
          u_colorMode: p.colorMode === 'original' ? 1 : 0,
          u_fg: hexToVec3(p.fgColor),
          u_bg: hexToVec3(p.bgColor),
        }, input)
        break
      }
      case 'dithering': {
        const p = s.dithering
        if (isErrorDiffusion(p.method) && !this.source.isTimeBased) {
          this.pass('copy', {}, this.cpuTarget.texture)
        } else {
          // inline pass: u_pal is a vec3[8] and must use uniform3fv (setVec3Array),
          // not the generic setter (which would emit an invalid uniform1fv call)
          const pal = this.paletteColors(p.palette)
          this.pp.write.bind()
          const prog = this.prog('dithering').use()
          prog.set({
            u_tex: this.tex(input, 0),
            u_noise: this.tex(this.noiseTex, 1),
            u_res: res,
            u_method: ditherMethodIndex(p.method),
            u_intensity: p.intensity,
            u_colorMode: ['mono', 'tonal', 'indexed', 'rgb', 'original'].indexOf(p.colorMode),
            u_levels: p.colorLevels,
            u_gamma: p.gamma,
            u_fg: hexToVec3(p.foregroundColor),
            u_bg: hexToVec3(p.backgroundColor),
            u_palCount: pal.count,
            u_paletteSize: p.paletteSize,
          })
          prog.setVec3Array('u_pal', pal.arr)
          this.quad.draw()
          this.pp.swap()
        }
        break
      }
      case 'halftone': {
        const p = s.halftone
        this.pass('halftone', {
          u_res: res,
          u_shape: ['circle', 'square', 'diamond', 'line'].indexOf(p.shape),
          u_dotScale: p.dotScale,
          u_spacing: Math.max(2, p.spacing),
          u_angle: p.angle,
          u_invert: p.invert,
          u_colorMode: p.colorMode === 'color' ? 1 : 0,
          u_fg: hexToVec3(p.fgColor),
          u_bg: hexToVec3(p.bgColor),
        }, input)
        break
      }
      case 'pixelSort': {
        const p = s.pixelSort
        this.pass('pixelSort', {
          u_res: res,
          u_dir: ['horizontal', 'vertical', 'diagonal'].indexOf(p.direction),
          u_mode: ['brightness', 'hue', 'saturation'].indexOf(p.mode),
          u_threshold: p.threshold,
          u_streak: p.streakLength,
          u_intensity: p.intensity,
          u_reverse: p.reverse,
        }, input)
        break
      }
      case 'dots': {
        const p = s.dots
        this.pass('dots', {
          u_res: res,
          u_shape: ['circle', 'square', 'diamond'].indexOf(p.shape),
          u_grid: p.gridType === 'hex' ? 1 : 0,
          u_size: p.sizeMultiplier,
          u_spacing: p.spacing,
          u_invert: p.invert,
          u_colorMode: p.colorMode === 'original' ? 1 : 0,
          u_fg: hexToVec3(p.fgColor),
          u_bg: hexToVec3(p.bgColor),
        }, input)
        break
      }
      case 'contour': {
        const p = s.contour
        this.pass('contour', {
          u_res: res,
          u_fillMode: p.fillMode === 'lines' ? 1 : 0,
          u_levels: p.levels,
          u_thickness: p.lineThickness,
          u_invert: p.invert,
          u_colorMode: p.colorMode === 'original' ? 1 : 0,
          u_line: hexToVec3(p.lineColor),
          u_bg: hexToVec3(p.bgColor),
        }, input)
        break
      }
      case 'edgeDetection': {
        const p = s.edgeDetection
        this.pass('edgeDetection', {
          u_res: res,
          u_algo: ['sobel', 'prewitt', 'laplacian'].indexOf(p.algorithm),
          u_threshold: p.threshold,
          u_lineWidth: p.lineWidth,
          u_invert: p.invert,
          u_colorMode: p.colorMode === 'original' ? 1 : 0,
          u_edge: hexToVec3(p.edgeColor),
          u_bg: hexToVec3(p.bgColor),
        }, input)
        break
      }
      case 'crosshatch': {
        const p = s.crosshatch
        this.pass('crosshatch', {
          u_res: res,
          u_density: p.density,
          u_layers: p.layers,
          u_angle: p.angle,
          u_lineWidth: p.lineWidth,
          u_randomness: p.randomness,
          u_invert: p.invert,
          u_fg: hexToVec3(p.fgColor),
          u_bg: hexToVec3(p.bgColor),
        }, input)
        break
      }
      case 'blockify': {
        const p = s.blockify
        this.pass('blockify', {
          u_res: res,
          u_block: Math.max(2, p.blockSize),
          u_style: ['full', 'shaded', 'outline'].indexOf(p.style),
          u_border: p.borderWidth,
          u_borderColor: hexToVec3(p.borderColor),
          u_colorMode: p.colorMode === 'grayscale' ? 1 : 0,
        }, input)
        break
      }
      case 'threshold': {
        const p = s.threshold
        this.pass('threshold', {
          u_noise: this.tex(this.noiseTex, 1),
          u_res: res,
          u_levels: p.levels,
          u_point: p.thresholdPoint,
          u_dither: p.dither,
          u_invert: p.invert,
          u_colorMode: p.colorMode === 'color' ? 1 : 0,
          u_fg: hexToVec3(p.fgColor),
          u_bg: hexToVec3(p.bgColor),
        }, input)
        break
      }
      case 'noiseField': {
        const p = s.noiseField
        this.pass('noiseField', {
          u_res: res,
          u_time: t,
          u_type: ['perlin', 'simplex', 'worley'].indexOf(p.noiseType),
          u_scale: p.scale,
          u_intensity: p.intensity,
          u_octaves: p.octaves,
          u_speed: p.speed,
          u_animate: p.animate,
          u_distortOnly: p.distortOnly,
        }, input)
        break
      }
      case 'matrixRain': {
        const p = s.matrixRain
        this.pass('matrixRain', {
          u_atlas: this.tex(this.atlasTex, 1),
          u_count: this.atlasCount,
          u_res: res,
          u_time: t,
          u_cell: Math.max(3, p.cellSize) * (1 + p.spacing),
          u_speed: p.speed,
          u_trail: p.trailLength,
          u_dir: ['down', 'up', 'left', 'right'].indexOf(p.direction),
          u_glow: p.glowIntensity,
          u_bgOpacity: p.bgOpacity,
          u_rain: hexToVec3(p.rainColor),
          u_threshold: p.threshold,
        }, input)
        break
      }
      case 'vhs': {
        const p = s.vhs
        this.pass('vhs', {
          u_res: res,
          u_time: t,
          u_distortion: p.distortion,
          u_noise: p.noise,
          u_colorBleed: p.colorBleed,
          u_scanlines: p.scanlines,
          u_tracking: p.trackingError,
        }, input)
        break
      }
      case 'voronoi': {
        const p = s.voronoi
        this.pass('voronoi', {
          u_res: res,
          u_cell: Math.max(4, p.cellSize),
          u_edgeWidth: p.edgeWidth,
          u_edgeColor: Number(p.edgeColor),
          u_colorMode: Number(p.colorMode),
          u_randomize: p.randomize,
        }, input)
        break
      }
    }
  }

  private runPost(s: Settings, t: number) {
    const res = this.res()
    const p = s.post
    if (p.chromatic.enabled) this.pass('chromatic', { u_res: res, u_offset: p.chromatic.offset })
    if (p.bloom.enabled)
      this.pass('bloom', {
        u_res: res,
        u_threshold: p.bloom.threshold,
        u_soft: p.bloom.softThreshold,
        u_intensity: p.bloom.intensity,
        u_radius: p.bloom.radius,
      })
    if (p.scanlines.enabled)
      this.pass('scanlines', { u_res: res, u_opacity: p.scanlines.opacity, u_spacing: p.scanlines.spacing })
    if (p.vignette.enabled)
      this.pass('vignette', { u_intensity: p.vignette.intensity, u_radius: p.vignette.radius })
    if (p.crtCurve.enabled) this.pass('crt', { u_amount: p.crtCurve.amount })
    if (p.grain.enabled)
      this.pass('grain', { u_res: res, u_time: t, u_intensity: p.grain.intensity, u_size: p.grain.size, u_speed: p.grain.speed })
    if (p.phosphor.enabled) {
      const col = p.phosphor.color === 'custom' ? p.phosphor.customColor : PHOSPHOR_COLORS[p.phosphor.color]
      this.pass('phosphor', { u_color: hexToVec3(col) })
    }
  }

  render(s: Settings, timeMs: number) {
    const gl = this.gl
    this.computeSize(s)
    if (this.canvas.width !== this.procW || this.canvas.height !== this.procH) {
      this.canvas.width = this.procW
      this.canvas.height = this.procH
    }
    this.pp.resize(this.procW, this.procH)
    this.ensureAtlas(s)
    const t = timeMs / 1000

    if (s.output.showOriginal) {
      this.pass('copy', {}, this.source.texture)
    } else {
      const ep = s[s.active] as { brightness: number; contrast: number }
      const ascii = s.active === 'ascii'
      this.pass('prep', {
        u_res: this.res(),
        u_brightness: ep.brightness / 100,
        u_contrast: ep.contrast / 100,
        u_isAscii: ascii,
        u_saturation: ascii ? s.ascii.saturation / 100 : 0,
        u_hue: ascii ? s.ascii.hue : 0,
        u_gamma: ascii ? s.ascii.gamma : 1,
        u_sharpness: ascii ? s.ascii.sharpness / 100 : 0,
        u_blur: ascii ? s.ascii.blur : 0,
        u_edge: ascii ? s.ascii.edgeEnhance / 100 : 0,
        u_quantize: ascii ? s.ascii.quantizeColors : 0,
      }, this.source.texture)
      const prepRT = this.pp.read
      if (s.active === 'dithering' && isErrorDiffusion(s.dithering.method) && !this.source.isTimeBased)
        this.maybeCpuDither(s, prepRT)
      this.runEffect(s, t, prepRT.texture)
      this.runPost(s, t)
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.procW, this.procH)
    this.prog('composite').use().set({
      u_tex: this.tex(this.pp.read.texture, 0),
      u_bg: hexToVec3(s.output.background),
    })
    this.quad.draw()
  }

  private maybeCpuDither(s: Settings, prepRT: RenderTarget) {
    const d = s.dithering
    // include brightness/contrast: they drive the prep pass that produces the
    // pixels read back here, so the cache must invalidate when they change
    const key = [d.method, d.colorMode, d.colorLevels, d.gamma, d.palette, d.paletteSize, d.foregroundColor, d.backgroundColor, d.brightness, d.contrast, this.procW, this.procH, s.active].join('|')
    if (key === this.cpuKey && this.cpuTarget.width === this.procW) return
    this.cpuKey = key
    const pal = this.paletteColors(d.palette)
    const data = computeCpuDither(this.gl, prepRT, this.procW, this.procH, d, pal.arr, pal.count)
    if (!data) return
    const gl = this.gl
    this.cpuTarget.resize(this.procW, this.procH)
    gl.bindTexture(gl.TEXTURE_2D, this.cpuTarget.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.procW, this.procH, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
  }

  private isAnimated(s: Settings): boolean {
    if (s.active === 'matrixRain' || s.active === 'vhs') return true
    if (s.active === 'noiseField' && s.noiseField.animate) return true
    if (s.post.grain.enabled && s.post.grain.speed > 0) return true
    return false
  }

  start() {
    if (this.running) return
    this.running = true
    this.startTime = performance.now()
    const loop = () => {
      if (!this.running) return
      const now = performance.now()
      const s = useStore.getState().settings
      const dirty = useStore.getState().dirty
      const srcChanged = this.source.update(now)
      const need = srcChanged || dirty !== this.lastDirty || this.source.isTimeBased || this.isAnimated(s)
      if (need) {
        this.lastDirty = dirty
        try {
          this.render(s, now - this.startTime)
          this.renderErrored = false
        } catch (e) {
          if (!this.renderErrored) {
            console.error('filtr: render error (continuing)', e)
            this.renderErrored = true
          }
        }
      }
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  renderNow() {
    this.render(useStore.getState().settings, performance.now() - this.startTime)
  }

  /** Prep-graded pixels (row 0 = image top) for the SVG/text exporters. */
  sampleAdjusted(): { data: Uint8Array; width: number; height: number } {
    const s = useStore.getState().settings
    this.computeSize(s)
    this.pp.resize(this.procW, this.procH)
    const ascii = s.active === 'ascii'
    const ep = s[s.active] as { brightness: number; contrast: number }
    this.pass('prep', {
      u_res: this.res(),
      u_brightness: ep.brightness / 100,
      u_contrast: ep.contrast / 100,
      u_isAscii: ascii,
      u_saturation: ascii ? s.ascii.saturation / 100 : 0,
      u_hue: ascii ? s.ascii.hue : 0,
      u_gamma: ascii ? s.ascii.gamma : 1,
      u_sharpness: ascii ? s.ascii.sharpness / 100 : 0,
      u_blur: ascii ? s.ascii.blur : 0,
      u_edge: ascii ? s.ascii.edgeEnhance / 100 : 0,
      u_quantize: ascii ? s.ascii.quantizeColors : 0,
    }, this.source.texture)
    const rt = this.pp.read
    const data = new Uint8Array(this.procW * this.procH * 4)
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, rt.fbo)
    this.gl.readPixels(0, 0, this.procW, this.procH, this.gl.RGBA, this.gl.UNSIGNED_BYTE, data)
    return { data, width: this.procW, height: this.procH }
  }

  dispose() {
    this.stop()
    this.source.dispose()
    this.pp.dispose()
    this.cpuTarget.dispose()
    this.programs.forEach((p) => p.dispose())
    this.gl.deleteTexture(this.noiseTex)
    this.gl.deleteTexture(this.atlasTex)
  }
}
