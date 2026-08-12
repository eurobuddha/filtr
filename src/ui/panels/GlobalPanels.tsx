import { useStore } from '@/state/store'
import { Panel } from './Panel'
import { ColorInput, Segmented, Select, Slider, Toggle, useSetting } from '../controls'

// ── ASCII-only adjustment panels (match the original's grouping) ─────────
export function AdjustmentsPanel() {
  const active = useStore((s) => s.settings.active)
  if (active !== 'ascii') return null
  return (
    <Panel title="Adjustments" defaultOpen={false}>
      <Slider path="ascii.brightness" label="Brightness" min={-100} max={100} />
      <Slider path="ascii.contrast" label="Contrast" min={-100} max={100} />
      <Slider path="ascii.saturation" label="Saturation" min={-100} max={100} />
      <Slider path="ascii.hue" label="Hue" min={0} max={360} format={(v) => `${Math.round(v)}°`} />
      <Slider path="ascii.sharpness" label="Sharpness" min={0} max={100} />
      <Slider path="ascii.gamma" label="Gamma" min={0.1} max={3} step={0.1} />
    </Panel>
  )
}

export function ColorPanel() {
  const active = useStore((s) => s.settings.active)
  const [mode] = useSetting<string>('ascii.colorMode')
  if (active !== 'ascii') return null
  return (
    <Panel title="Color" defaultOpen={false}>
      <Segmented path="ascii.colorMode" options={[{ value: 'mono', label: 'Mono' }, { value: 'original', label: 'Original' }]} />
      {mode === 'mono' && <ColorInput path="ascii.custom" label="Character" />}
      <ColorInput path="ascii.backgroundColor" label="Background" />
      <Slider path="ascii.intensity" label="Intensity" min={0} max={2} step={0.1} />
    </Panel>
  )
}

export function ProcessingPanel() {
  const active = useStore((s) => s.settings.active)
  if (active !== 'ascii') return null
  return (
    <Panel title="Processing" defaultOpen={false}>
      <Toggle path="ascii.invert" label="Invert" />
      <Slider path="ascii.brightnessMapping" label="Bright Map" min={0.1} max={2} step={0.05} />
      <Slider path="ascii.edgeEnhance" label="Edge Enhance" min={0} max={100} />
      <Slider path="ascii.blur" label="Blur" min={0} max={10} step={0.5} />
      <Slider path="ascii.quantizeColors" label="Quantize" min={0} max={256} format={(v) => (v < 2 ? 'off' : String(Math.round(v)))} />
    </Panel>
  )
}

// ── Post-processing ─────────────────────────────────────────────────────
function PostFx({ name, label, children }: { name: string; label: string; children?: React.ReactNode }) {
  const [on] = useSetting<boolean>(`post.${name}.enabled`)
  return (
    <div className="border-b border-border/60 py-1 last:border-0">
      <Toggle path={`post.${name}.enabled`} label={label} />
      {on && children && <div className="mt-1 space-y-0.5 pl-1">{children}</div>}
    </div>
  )
}

export function PostPanel() {
  const [phos] = useSetting<string>('post.phosphor.color')
  return (
    <Panel title="Post-Processing" defaultOpen={false}>
      <PostFx name="bloom" label="Bloom">
        <Slider path="post.bloom.threshold" label="Threshold" min={0} max={1} step={0.05} />
        <Slider path="post.bloom.softThreshold" label="Soft Thr" min={0} max={1} step={0.05} />
        <Slider path="post.bloom.intensity" label="Intensity" min={0} max={2} step={0.1} />
        <Slider path="post.bloom.radius" label="Radius" min={1} max={20} />
      </PostFx>
      <PostFx name="grain" label="Grain">
        <Slider path="post.grain.intensity" label="Intensity" min={0} max={200} />
        <Slider path="post.grain.size" label="Size" min={1} max={10} />
        <Slider path="post.grain.speed" label="Speed" min={1} max={200} />
      </PostFx>
      <PostFx name="chromatic" label="Chromatic">
        <Slider path="post.chromatic.offset" label="Offset" min={0} max={50} />
      </PostFx>
      <PostFx name="scanlines" label="Scanlines">
        <Slider path="post.scanlines.opacity" label="Opacity" min={0} max={1} step={0.05} />
        <Slider path="post.scanlines.spacing" label="Spacing" min={1} max={20} />
      </PostFx>
      <PostFx name="vignette" label="Vignette">
        <Slider path="post.vignette.intensity" label="Intensity" min={0} max={1} step={0.05} />
        <Slider path="post.vignette.radius" label="Radius" min={0} max={1} step={0.05} />
      </PostFx>
      <PostFx name="crtCurve" label="CRT Curve">
        <Slider path="post.crtCurve.amount" label="Amount" min={0} max={0.5} step={0.01} />
      </PostFx>
      <PostFx name="phosphor" label="Phosphor">
        <Select path="post.phosphor.color" label="Color" options={[{ value: 'green', label: 'Green' }, { value: 'amber', label: 'Amber' }, { value: 'white', label: 'White' }, { value: 'custom', label: 'Custom' }]} />
        {phos === 'custom' && <ColorInput path="post.phosphor.customColor" label="Custom" />}
      </PostFx>
    </Panel>
  )
}

/**
 * Shows the real pixel size everything renders and exports at. The Resolution
 * cap silently degraded exports before this existed — a user lowering it for a
 * smoother preview had no way to see what they were actually saving.
 */
function OutputSize() {
  const source = useStore((s) => s.source)
  const cap = useStore((s) => s.settings.output.maxPreviewDim)
  if (source.kind === 'none') return null
  const longest = Math.max(source.width, source.height)
  const k = longest > cap ? cap / longest : 1
  const w = Math.max(1, Math.round(source.width * k))
  const h = Math.max(1, Math.round(source.height * k))
  return (
    <div className="flex h-6 items-center justify-between">
      <span className="label">Output</span>
      <span className="tabular-nums text-[11px] text-fg-dim">
        {w}×{h}
        {k < 1 && <span className="text-faint"> · capped</span>}
      </span>
    </div>
  )
}

export function OutputPanel() {
  return (
    <Panel title="Output" defaultOpen={false}>
      <ColorInput path="output.background" label="Background" />
      <Toggle path="output.showOriginal" label="Show Original" />
      {/* Caps the render buffer for preview AND export — they share one canvas. */}
      <Slider path="output.maxPreviewDim" label="Resolution" min={512} max={4096} step={128} />
      <OutputSize />
    </Panel>
  )
}
