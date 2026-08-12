import type { Preset } from './types'

// Built-in presets — deterministic patches applied over defaults.
export const BUILTIN_PRESETS: Preset[] = [
  {
    id: 'classic-terminal',
    name: 'Classic Terminal',
    builtin: true,
    settings: {
      active: 'ascii',
      ascii: { set: 'standard', scale: 2, colorMode: 'mono', custom: '#33ff66', backgroundColor: '#020a02' },
      post: { scanlines: { enabled: true, opacity: 0.25, spacing: 3 } },
    },
  },
  {
    id: 'amber-crt',
    name: 'Amber CRT',
    builtin: true,
    settings: {
      active: 'ascii',
      ascii: { set: 'detailed', scale: 2, colorMode: 'mono', custom: '#ffb000', backgroundColor: '#0a0600' },
      post: {
        crtCurve: { enabled: true, amount: 0.18 },
        bloom: { enabled: true, threshold: 0.3, softThreshold: 0.2, intensity: 0.8, radius: 10 },
        scanlines: { enabled: true, opacity: 0.2, spacing: 3 },
      },
    },
  },
  {
    id: 'newsprint',
    name: 'Newsprint',
    builtin: true,
    settings: {
      active: 'halftone',
      halftone: { shape: 'circle', spacing: 6, angle: 45, colorMode: 'bw', fgColor: '#111111', bgColor: '#f4f1e3', contrast: 15 },
    },
  },
  {
    id: 'risograph',
    name: 'Risograph',
    builtin: true,
    settings: {
      active: 'dithering',
      dithering: { method: 'atkinson', colorMode: 'indexed', palette: 'riso' },
      post: { grain: { enabled: true, intensity: 20, size: 1, speed: 1 } },
    },
  },
  {
    id: 'gameboy',
    name: 'GameBoy',
    builtin: true,
    settings: {
      active: 'dithering',
      dithering: { method: 'bayer4x4', colorMode: 'indexed', palette: 'gameboy' },
      // No maxPreviewDim override — it caps exports too, so pinning it here
      // quietly quartered the output resolution for anyone using this preset.
      output: { background: '#0f380f', showOriginal: false },
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    builtin: true,
    settings: {
      active: 'edgeDetection',
      edgeDetection: { algorithm: 'sobel', threshold: 0.18, colorMode: 'custom', edgeColor: '#05d9e8', bgColor: '#0a0118' },
      post: { bloom: { enabled: true, threshold: 0.2, softThreshold: 0.3, intensity: 1.4, radius: 14 }, chromatic: { enabled: true, offset: 4 } },
    },
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    builtin: true,
    settings: {
      active: 'edgeDetection',
      edgeDetection: { algorithm: 'sobel', threshold: 0.2, colorMode: 'custom', edgeColor: '#cfe3ff', bgColor: '#0d2747' },
    },
  },
  {
    id: 'comic-ink',
    name: 'Comic Ink',
    builtin: true,
    settings: {
      active: 'crosshatch',
      crosshatch: { density: 5, layers: 3, angle: 45, lineWidth: 1, fgColor: '#0a0a0a', bgColor: '#ffffff', contrast: 20 },
    },
  },
  {
    id: 'matrix-rain',
    name: 'Matrix Rain',
    builtin: true,
    settings: {
      active: 'matrixRain',
      matrixRain: { cellSize: 12, speed: 1.2, trailLength: 18, rainColor: '#00ff66', glowIntensity: 1.2, bgOpacity: 0.4 },
      post: { bloom: { enabled: true, threshold: 0.3, softThreshold: 0.2, intensity: 0.7, radius: 8 } },
    },
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    builtin: true,
    settings: {
      active: 'dithering',
      dithering: { method: 'bayer8x8', colorMode: 'original', colorLevels: 4, brightness: 5, contrast: 10 },
      post: {
        chromatic: { enabled: true, offset: 6 },
        grain: { enabled: true, intensity: 25, size: 1, speed: 40 },
        vignette: { enabled: true, intensity: 0.4, radius: 0.6 },
      },
    },
  },
  {
    id: 'glitch-sort',
    name: 'Glitch Sort',
    builtin: true,
    settings: {
      active: 'pixelSort',
      pixelSort: { direction: 'vertical', mode: 'brightness', threshold: 0.3, streakLength: 200, intensity: 1 },
      post: { chromatic: { enabled: true, offset: 3 } },
    },
  },
  {
    id: 'vhs-tape',
    name: 'VHS Tape',
    builtin: true,
    settings: {
      active: 'vhs',
      vhs: { distortion: 0.5, noise: 0.35, colorBleed: 0.6, scanlines: 0.4, trackingError: 0.3 },
      post: { scanlines: { enabled: true, opacity: 0.15, spacing: 3 } },
    },
  },
  {
    id: 'stained-glass',
    name: 'Stained Glass',
    builtin: true,
    settings: {
      active: 'voronoi',
      voronoi: { cellSize: 36, edgeWidth: 0.4, edgeColor: 0, colorMode: 0, randomize: 0.9 },
    },
  },
  {
    id: 'topographic',
    name: 'Topographic',
    builtin: true,
    settings: {
      active: 'contour',
      contour: { fillMode: 'lines', levels: 12, lineThickness: 1, colorMode: 'original', bgColor: '#0a0a0a' },
    },
  },
]
