// ─────────────────────────────────────────────────────────────────────────
// filtr parameter model — mirrors grainrad's effect/settings structure.
// 15 first-class effects, each self-contained (own brightness/contrast/colour
// mode). ASCII additionally carries the global image/colour/advanced controls.
// ─────────────────────────────────────────────────────────────────────────

export type SourceKind = 'none' | 'image' | 'video' | 'gif' | 'webcam'

export type EffectId =
  | 'ascii'
  | 'waveLines'
  | 'dithering'
  | 'halftone'
  | 'pixelSort'
  | 'dots'
  | 'contour'
  | 'edgeDetection'
  | 'crosshatch'
  | 'blockify'
  | 'threshold'
  | 'noiseField'
  | 'matrixRain'
  | 'vhs'
  | 'voronoi'

export const EFFECT_ORDER: EffectId[] = [
  'ascii',
  'dithering',
  'halftone',
  'matrixRain',
  'contour',
  'pixelSort',
  'dots',
  'edgeDetection',
  'crosshatch',
  'blockify',
  'threshold',
  'noiseField',
  'waveLines',
  'voronoi',
  'vhs',
]

export const EFFECT_LABELS: Record<EffectId, string> = {
  ascii: 'ASCII',
  dithering: 'Dithering',
  halftone: 'Halftone',
  matrixRain: 'Matrix Rain',
  contour: 'Contour',
  pixelSort: 'Pixel Sort',
  dots: 'Dots',
  edgeDetection: 'Edge Detection',
  crosshatch: 'Crosshatch',
  blockify: 'Blockify',
  threshold: 'Threshold',
  noiseField: 'Noise Field',
  waveLines: 'Wave Lines',
  voronoi: 'Voronoi',
  vhs: 'VHS',
}

// ── ASCII (special: holds the global image/colour/advanced adjustments) ──
export interface AsciiParams {
  scale: number // 1..20
  spacing: number // 0..1
  outputWidth: number // 0 = auto, else 0..500
  set: string
  customChars: string
  // image adjustments
  brightness: number // -100..100
  contrast: number
  saturation: number
  hue: number // 0..360
  sharpness: number // 0..100
  gamma: number // 0.1..3
  // colour
  colorMode: 'mono' | 'original'
  custom: string // character colour
  backgroundColor: string
  intensity: number // 0..2
  // advanced
  invert: boolean
  brightnessMapping: number // 0.1..2
  edgeEnhance: number // 0..100
  blur: number // 0..10
  quantizeColors: number // 0..256
}

export interface WaveLinesParams {
  lineCount: number
  amplitude: number
  frequency: number
  direction: 'horizontal' | 'vertical'
  lineThickness: number
  colorMode: 'custom' | 'original'
  fgColor: string
  bgColor: string
  brightness: number
  contrast: number
}

export type DitherMethod =
  | 'floydSteinberg'
  | 'atkinson'
  | 'jarvisJudiceNinke'
  | 'stucki'
  | 'burkes'
  | 'sierra'
  | 'sierraTwoRow'
  | 'sierraLite'
  | 'bayer2x2'
  | 'bayer4x4'
  | 'bayer8x8'
  | 'bayer16x16'
  | 'clusteredDot'
  | 'blueNoise'
  | 'interleavedGradient'

export interface DitheringParams {
  method: DitherMethod
  intensity: number
  colorMode: 'mono' | 'tonal' | 'indexed' | 'rgb' | 'original'
  colorLevels: number // 2..32
  gamma: number
  sharpen: number // -1..1
  foregroundColor: string
  backgroundColor: string
  palette: string // for indexed
  paletteSize: number // 2..64 for rgb
  brightness: number
  contrast: number
}

export interface HalftoneParams {
  shape: 'circle' | 'square' | 'diamond' | 'line'
  dotScale: number
  spacing: number
  angle: number
  invert: boolean
  colorMode: 'bw' | 'color'
  fgColor: string
  bgColor: string
  brightness: number
  contrast: number
}

export interface PixelSortParams {
  direction: 'horizontal' | 'vertical' | 'diagonal'
  mode: 'brightness' | 'hue' | 'saturation'
  threshold: number // 0..0.5
  streakLength: number
  intensity: number
  reverse: boolean
  brightness: number
  contrast: number
}

export interface DotsParams {
  shape: 'circle' | 'square' | 'diamond'
  gridType: 'square' | 'hex'
  sizeMultiplier: number
  spacing: number
  invert: boolean
  colorMode: 'custom' | 'original'
  fgColor: string
  bgColor: string
  brightness: number
  contrast: number
}

export interface ContourParams {
  fillMode: 'filled' | 'lines'
  levels: number // 3..20
  lineThickness: number
  invert: boolean
  colorMode: 'custom' | 'original'
  lineColor: string
  bgColor: string
  brightness: number
  contrast: number
}

export interface EdgeParams {
  algorithm: 'sobel' | 'prewitt' | 'laplacian'
  threshold: number
  lineWidth: number
  invert: boolean
  colorMode: 'custom' | 'original'
  edgeColor: string
  bgColor: string
  brightness: number
  contrast: number
}

export interface CrosshatchParams {
  density: number
  layers: number // 1..4
  angle: number
  lineWidth: number
  randomness: number
  invert: boolean
  fgColor: string
  bgColor: string
  brightness: number
  contrast: number
}

export interface BlockifyParams {
  style: 'full' | 'shaded' | 'outline'
  blockSize: number
  borderWidth: number
  colorMode: 'color' | 'grayscale'
  borderColor: string
  brightness: number
  contrast: number
}

export interface ThresholdParams {
  levels: number // 2..8
  thresholdPoint: number // 0.1..0.9
  dither: boolean
  invert: boolean
  colorMode: 'custom' | 'color'
  fgColor: string
  bgColor: string
  brightness: number
  contrast: number
}

export interface NoiseFieldParams {
  noiseType: 'perlin' | 'simplex' | 'worley'
  scale: number
  intensity: number
  octaves: number
  speed: number
  animate: boolean
  distortOnly: boolean
  brightness: number
  contrast: number
}

export interface MatrixParams {
  characterSet: string
  customChars: string
  cellSize: number
  spacing: number
  speed: number
  trailLength: number
  direction: 'down' | 'up' | 'left' | 'right'
  glowIntensity: number
  bgOpacity: number
  rainColor: string
  brightness: number
  contrast: number
  threshold: number
}

export interface VhsParams {
  distortion: number
  noise: number
  colorBleed: number
  scanlines: number
  trackingError: number
  brightness: number
  contrast: number
}

export interface VoronoiParams {
  cellSize: number
  edgeWidth: number
  edgeColor: 0 | 1 | 2 // black / white / darkened
  colorMode: 0 | 1 | 2 // cell average / center sample / gradient
  randomize: number
  brightness: number
  contrast: number
}

// ── post-processing ───────────────────────────────────────────────────
export interface PostParams {
  bloom: { enabled: boolean; threshold: number; softThreshold: number; intensity: number; radius: number }
  grain: { enabled: boolean; intensity: number; size: number; speed: number }
  chromatic: { enabled: boolean; offset: number }
  scanlines: { enabled: boolean; opacity: number; spacing: number }
  vignette: { enabled: boolean; intensity: number; radius: number }
  crtCurve: { enabled: boolean; amount: number }
  phosphor: { enabled: boolean; color: 'green' | 'amber' | 'white' | 'custom'; customColor: string }
}

export interface OutputParams {
  background: string
  showOriginal: boolean
  /** quality cap for the live preview; export always uses native resolution */
  maxPreviewDim: number
}

export interface Settings {
  active: EffectId
  ascii: AsciiParams
  waveLines: WaveLinesParams
  dithering: DitheringParams
  halftone: HalftoneParams
  pixelSort: PixelSortParams
  dots: DotsParams
  contour: ContourParams
  edgeDetection: EdgeParams
  crosshatch: CrosshatchParams
  blockify: BlockifyParams
  threshold: ThresholdParams
  noiseField: NoiseFieldParams
  matrixRain: MatrixParams
  vhs: VhsParams
  voronoi: VoronoiParams
  post: PostParams
  output: OutputParams
}

export interface Preset {
  id: string
  name: string
  description?: string
  builtin?: boolean
  settings: DeepPartial<Settings>
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}
