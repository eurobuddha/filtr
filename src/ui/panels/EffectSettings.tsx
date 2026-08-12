import { useStore } from '@/state/store'
import { CHARSETS } from '@/engine/charsets'
import { PALETTES } from '@/engine/palettes'
import type { EffectId } from '@/state/types'
import { Panel } from './Panel'
import { ColorInput, Segmented, Select, Slider, TextInput, Toggle, useSetting } from '../controls'

const charsetOptions = CHARSETS.map((c) => ({ value: c.id, label: c.name }))

function BC({ base }: { base: EffectId }) {
  return (
    <>
      <Slider path={`${base}.brightness`} label="Brightness" min={-100} max={100} />
      <Slider path={`${base}.contrast`} label="Contrast" min={-100} max={100} />
    </>
  )
}

export function EffectSettings() {
  const active = useStore((s) => s.settings.active)
  const label = active === 'ascii' ? 'ASCII' : 'Settings'
  return (
    <Panel title={label}>
      {active === 'ascii' && <Ascii />}
      {active === 'waveLines' && <WaveLines />}
      {active === 'dithering' && <Dithering />}
      {active === 'halftone' && <Halftone />}
      {active === 'pixelSort' && <PixelSort />}
      {active === 'dots' && <Dots />}
      {active === 'contour' && <Contour />}
      {active === 'edgeDetection' && <Edge />}
      {active === 'crosshatch' && <Crosshatch />}
      {active === 'blockify' && <Blockify />}
      {active === 'threshold' && <Threshold />}
      {active === 'noiseField' && <NoiseField />}
      {active === 'matrixRain' && <Matrix />}
      {active === 'vhs' && <Vhs />}
      {active === 'voronoi' && <Voronoi />}
    </Panel>
  )
}

function Ascii() {
  const [set] = useSetting<string>('ascii.set')
  return (
    <>
      <Slider path="ascii.scale" label="Scale" min={1} max={20} />
      <Slider path="ascii.spacing" label="Spacing" min={0} max={1} step={0.05} />
      <Slider path="ascii.outputWidth" label="Output Width" min={0} max={500} step={10} />
      <Select path="ascii.set" label="Char Set" options={charsetOptions} />
      {set === 'custom' && <TextInput path="ascii.customChars" label="Custom" placeholder=" .:+*#@" />}
    </>
  )
}

function WaveLines() {
  const [cm] = useSetting<string>('waveLines.colorMode')
  return (
    <>
      <Slider path="waveLines.lineCount" label="Line Count" min={10} max={150} step={5} />
      <Slider path="waveLines.amplitude" label="Amplitude" min={5} max={50} />
      <Slider path="waveLines.frequency" label="Frequency" min={0.5} max={3} step={0.1} />
      <Slider path="waveLines.lineThickness" label="Thickness" min={0.5} max={3} step={0.1} />
      <Segmented path="waveLines.direction" label="Direction" options={[{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }]} />
      <Segmented path="waveLines.colorMode" options={[{ value: 'custom', label: 'Mono' }, { value: 'original', label: 'Original' }]} />
      {cm === 'custom' && <ColorInput path="waveLines.fgColor" label="Line Color" />}
      <ColorInput path="waveLines.bgColor" label="Background" />
      <BC base="waveLines" />
    </>
  )
}

function Dithering() {
  const [cm] = useSetting<string>('dithering.colorMode')
  return (
    <>
      <Select
        path="dithering.method"
        label="Algorithm"
        options={[
          { value: 'floydSteinberg', label: 'Floyd–Steinberg' },
          { value: 'atkinson', label: 'Atkinson' },
          { value: 'jarvisJudiceNinke', label: 'Jarvis-Judice-Ninke' },
          { value: 'stucki', label: 'Stucki' },
          { value: 'burkes', label: 'Burkes' },
          { value: 'sierra', label: 'Sierra' },
          { value: 'sierraTwoRow', label: 'Sierra 2-Row' },
          { value: 'sierraLite', label: 'Sierra Lite' },
          { value: 'bayer2x2', label: 'Bayer 2×2' },
          { value: 'bayer4x4', label: 'Bayer 4×4' },
          { value: 'bayer8x8', label: 'Bayer 8×8' },
          { value: 'bayer16x16', label: 'Bayer 16×16' },
          { value: 'clusteredDot', label: 'Clustered Dot' },
          { value: 'blueNoise', label: 'Blue Noise' },
          { value: 'interleavedGradient', label: 'Interleaved Gradient' },
        ]}
      />
      <Slider path="dithering.intensity" label="Intensity" min={0.1} max={2} step={0.05} />
      <Slider path="dithering.gamma" label="Gamma" min={0.5} max={2} step={0.05} />
      <Select
        path="dithering.colorMode"
        label="Mode"
        options={[
          { value: 'mono', label: 'Mono' },
          { value: 'tonal', label: 'Tonal' },
          { value: 'indexed', label: 'Palette' },
          { value: 'rgb', label: 'RGB' },
          { value: 'original', label: 'Original' },
        ]}
      />
      {(cm === 'tonal' || cm === 'original') && <Slider path="dithering.colorLevels" label="Levels" min={2} max={32} />}
      {cm === 'rgb' && <Slider path="dithering.paletteSize" label="Color Depth" min={2} max={64} />}
      {cm === 'indexed' && (
        <Select path="dithering.palette" label="Palette" options={PALETTES.filter((p) => p.id !== 'none').map((p) => ({ value: p.id, label: p.name }))} />
      )}
      {(cm === 'mono' || cm === 'tonal') && (
        <>
          <ColorInput path="dithering.foregroundColor" label="Foreground" />
          <ColorInput path="dithering.backgroundColor" label="Background" />
        </>
      )}
      <BC base="dithering" />
    </>
  )
}

function Halftone() {
  const [cm] = useSetting<string>('halftone.colorMode')
  return (
    <>
      <Segmented path="halftone.shape" label="Shape" options={[{ value: 'circle', label: 'Circle' }, { value: 'square', label: 'Square' }, { value: 'diamond', label: 'Diamond' }, { value: 'line', label: 'Line' }]} />
      <Slider path="halftone.dotScale" label="Dot Scale" min={0.5} max={2} step={0.1} />
      <Slider path="halftone.spacing" label="Spacing" min={1} max={20} />
      <Slider path="halftone.angle" label="Angle" min={0} max={90} step={5} format={(v) => `${v}°`} />
      <Toggle path="halftone.invert" label="Invert" />
      <Segmented path="halftone.colorMode" options={[{ value: 'bw', label: 'Mono' }, { value: 'color', label: 'Original' }]} />
      {cm === 'bw' && (
        <>
          <ColorInput path="halftone.fgColor" label="Foreground" />
          <ColorInput path="halftone.bgColor" label="Background" />
        </>
      )}
      <BC base="halftone" />
    </>
  )
}

function PixelSort() {
  return (
    <>
      <Segmented path="pixelSort.direction" label="Direction" options={[{ value: 'horizontal', label: 'Horiz' }, { value: 'vertical', label: 'Vert' }, { value: 'diagonal', label: 'Diag' }]} />
      <Segmented path="pixelSort.mode" label="Sort By" options={[{ value: 'brightness', label: 'Bright' }, { value: 'hue', label: 'Hue' }, { value: 'saturation', label: 'Sat' }]} />
      <Slider path="pixelSort.threshold" label="Threshold" min={0} max={0.5} step={0.05} />
      <Slider path="pixelSort.streakLength" label="Streak Len" min={10} max={300} step={10} />
      <Slider path="pixelSort.intensity" label="Intensity" min={0} max={1} step={0.05} />
      <Toggle path="pixelSort.reverse" label="Reverse" />
      <BC base="pixelSort" />
    </>
  )
}

function Dots() {
  const [cm] = useSetting<string>('dots.colorMode')
  return (
    <>
      <Segmented path="dots.shape" label="Shape" options={[{ value: 'circle', label: 'Circle' }, { value: 'square', label: 'Square' }, { value: 'diamond', label: 'Diamond' }]} />
      <Segmented path="dots.gridType" label="Grid" options={[{ value: 'square', label: 'Square' }, { value: 'hex', label: 'Hex' }]} />
      <Slider path="dots.sizeMultiplier" label="Size" min={0.5} max={2} step={0.1} />
      <Slider path="dots.spacing" label="Spacing" min={0.5} max={2} step={0.1} />
      <Toggle path="dots.invert" label="Invert" />
      <Segmented path="dots.colorMode" options={[{ value: 'custom', label: 'Mono' }, { value: 'original', label: 'Original' }]} />
      {cm === 'custom' && <ColorInput path="dots.fgColor" label="Dot Color" />}
      <ColorInput path="dots.bgColor" label="Background" />
      <BC base="dots" />
    </>
  )
}

function Contour() {
  const [cm] = useSetting<string>('contour.colorMode')
  return (
    <>
      <Segmented path="contour.fillMode" label="Fill Mode" options={[{ value: 'filled', label: 'Filled' }, { value: 'lines', label: 'Lines' }]} />
      <Slider path="contour.levels" label="Levels" min={3} max={20} />
      <Slider path="contour.lineThickness" label="Thickness" min={0.5} max={3} step={0.25} />
      <Toggle path="contour.invert" label="Invert" />
      <Segmented path="contour.colorMode" options={[{ value: 'custom', label: 'Mono' }, { value: 'original', label: 'Original' }]} />
      {cm === 'custom' && <ColorInput path="contour.lineColor" label="Line Color" />}
      <ColorInput path="contour.bgColor" label="Background" />
      <BC base="contour" />
    </>
  )
}

function Edge() {
  const [cm] = useSetting<string>('edgeDetection.colorMode')
  return (
    <>
      <Select path="edgeDetection.algorithm" label="Algorithm" options={[{ value: 'sobel', label: 'Sobel' }, { value: 'prewitt', label: 'Prewitt' }, { value: 'laplacian', label: 'Laplacian' }]} />
      <Slider path="edgeDetection.threshold" label="Threshold" min={0.1} max={0.8} step={0.05} />
      <Slider path="edgeDetection.lineWidth" label="Line Width" min={0.5} max={4} step={0.5} />
      <Toggle path="edgeDetection.invert" label="Invert" />
      <Segmented path="edgeDetection.colorMode" options={[{ value: 'custom', label: 'Mono' }, { value: 'original', label: 'Original' }]} />
      {cm === 'custom' && <ColorInput path="edgeDetection.edgeColor" label="Edge Color" />}
      <ColorInput path="edgeDetection.bgColor" label="Background" />
      <BC base="edgeDetection" />
    </>
  )
}

function Crosshatch() {
  return (
    <>
      <Slider path="crosshatch.density" label="Density" min={2} max={12} />
      <Slider path="crosshatch.layers" label="Layers" min={1} max={4} />
      <Slider path="crosshatch.angle" label="Angle" min={0} max={90} step={5} format={(v) => `${v}°`} />
      <Slider path="crosshatch.lineWidth" label="Line Width" min={0.5} max={3} step={0.25} />
      <Slider path="crosshatch.randomness" label="Randomness" min={0} max={1} step={0.05} />
      <Toggle path="crosshatch.invert" label="Invert" />
      <ColorInput path="crosshatch.fgColor" label="Line Color" />
      <ColorInput path="crosshatch.bgColor" label="Background" />
      <BC base="crosshatch" />
    </>
  )
}

function Blockify() {
  const [bw] = useSetting<number>('blockify.borderWidth')
  return (
    <>
      <Segmented path="blockify.style" label="Style" options={[{ value: 'full', label: 'Full' }, { value: 'shaded', label: 'Shaded' }, { value: 'outline', label: 'Outline' }]} />
      <Slider path="blockify.blockSize" label="Block Size" min={4} max={20} />
      <Slider path="blockify.borderWidth" label="Border" min={0} max={3} step={0.5} />
      {bw > 0 && <ColorInput path="blockify.borderColor" label="Border Color" />}
      <Segmented path="blockify.colorMode" options={[{ value: 'color', label: 'Color' }, { value: 'grayscale', label: 'Grayscale' }]} />
      <BC base="blockify" />
    </>
  )
}

function Threshold() {
  const [cm] = useSetting<string>('threshold.colorMode')
  return (
    <>
      <Slider path="threshold.levels" label="Levels" min={2} max={8} />
      <Slider path="threshold.thresholdPoint" label="Point" min={0.1} max={0.9} step={0.05} />
      <Toggle path="threshold.dither" label="Dither" />
      <Toggle path="threshold.invert" label="Invert" />
      <Segmented path="threshold.colorMode" options={[{ value: 'custom', label: 'Mono' }, { value: 'color', label: 'Original' }]} />
      {cm === 'custom' && (
        <>
          <ColorInput path="threshold.fgColor" label="Foreground" />
          <ColorInput path="threshold.bgColor" label="Background" />
        </>
      )}
      <BC base="threshold" />
    </>
  )
}

function NoiseField() {
  return (
    <>
      <Select path="noiseField.noiseType" label="Noise" options={[{ value: 'perlin', label: 'Perlin' }, { value: 'simplex', label: 'Simplex' }, { value: 'worley', label: 'Worley' }]} />
      <Slider path="noiseField.scale" label="Scale" min={10} max={100} step={5} />
      <Slider path="noiseField.intensity" label="Intensity" min={0.5} max={3} step={0.1} />
      <Slider path="noiseField.octaves" label="Octaves" min={1} max={8} />
      <Slider path="noiseField.speed" label="Speed" min={0.1} max={3} step={0.1} />
      <Toggle path="noiseField.animate" label="Animate" />
      <Toggle path="noiseField.distortOnly" label="Distort Only" />
      <BC base="noiseField" />
    </>
  )
}

function Matrix() {
  const [set] = useSetting<string>('matrixRain.characterSet')
  return (
    <>
      <Select path="matrixRain.characterSet" label="Char Set" options={charsetOptions} />
      {set === 'custom' && <TextInput path="matrixRain.customChars" label="Custom" />}
      <Slider path="matrixRain.cellSize" label="Cell Size" min={4} max={32} />
      <Slider path="matrixRain.speed" label="Speed" min={0.5} max={3} step={0.1} />
      <Slider path="matrixRain.trailLength" label="Trail" min={5} max={30} />
      <Select path="matrixRain.direction" label="Direction" options={[{ value: 'down', label: 'Down' }, { value: 'up', label: 'Up' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />
      <Slider path="matrixRain.glowIntensity" label="Glow" min={0} max={2} step={0.1} />
      <Slider path="matrixRain.bgOpacity" label="BG Opacity" min={0} max={1} step={0.05} />
      <Slider path="matrixRain.threshold" label="Threshold" min={0} max={0.5} step={0.01} />
      <ColorInput path="matrixRain.rainColor" label="Rain Color" />
      <BC base="matrixRain" />
    </>
  )
}

function Vhs() {
  return (
    <>
      <Slider path="vhs.distortion" label="Distortion" min={0} max={1} step={0.05} />
      <Slider path="vhs.noise" label="Noise" min={0} max={1} step={0.05} />
      <Slider path="vhs.colorBleed" label="Color Bleed" min={0} max={1} step={0.05} />
      <Slider path="vhs.scanlines" label="Scanlines" min={0} max={1} step={0.05} />
      <Slider path="vhs.trackingError" label="Tracking" min={0} max={1} step={0.05} />
      <BC base="vhs" />
    </>
  )
}

function Voronoi() {
  return (
    <>
      <Slider path="voronoi.cellSize" label="Cell Size" min={10} max={100} step={5} />
      <Slider path="voronoi.edgeWidth" label="Edge Width" min={0} max={1} step={0.05} />
      <Select path="voronoi.edgeColor" label="Edge Color" options={[{ value: '0', label: 'Black' }, { value: '1', label: 'White' }, { value: '2', label: 'Darkened' }]} />
      <Select path="voronoi.colorMode" label="Color" options={[{ value: '0', label: 'Cell Average' }, { value: '1', label: 'Center Sample' }, { value: '2', label: 'Gradient' }]} />
      <Slider path="voronoi.randomize" label="Randomize" min={0} max={1} step={0.05} />
      <BC base="voronoi" />
    </>
  )
}
