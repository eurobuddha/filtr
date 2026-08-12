import { useState } from 'react'
import { Copy } from 'lucide-react'
import { Panel } from './Panel'
import { useRenderer } from '../RendererProvider'
import { useStore } from '@/state/store'
import { exportStill } from '@/export/still'
import { exportGif } from '@/export/gif'
import { recordVideo, videoSupported } from '@/export/video'
import { exportSvg, svgSupported } from '@/export/svg'
import { copyAsciiText, exportAsciiText } from '@/export/text'

type Fmt = 'png' | 'jpg' | 'gif' | 'video' | 'svg' | 'txt'
const FORMATS: { id: Fmt; label: string; ext: string }[] = [
  { id: 'png', label: 'PNG', ext: '.png' },
  { id: 'jpg', label: 'JPG', ext: '.jpg' },
  { id: 'gif', label: 'GIF', ext: '.gif' },
  { id: 'video', label: 'Video', ext: '.mp4' },
  { id: 'svg', label: 'SVG', ext: '.svg' },
  { id: 'txt', label: 'Text', ext: '.txt' },
]

export function ExportPanel() {
  const { get } = useRenderer()
  const active = useStore((s) => s.settings.active)
  const has = useStore((s) => s.source.kind !== 'none')
  const [fmt, setFmt] = useState<Fmt>('png')
  const [seconds, setSeconds] = useState(3)
  const [fps, setFps] = useState(12)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)

  const svgOk = svgSupported(active)
  const txtOk = active === 'ascii'
  const vidOk = videoSupported()
  const disabled = !has || busy || (fmt === 'svg' && !svgOk) || (fmt === 'txt' && !txtOk) || (fmt === 'video' && !vidOk)

  async function run() {
    const r = get()
    if (!r || busy) return
    setBusy(true); setProgress(0)
    try {
      if (fmt === 'png') await exportStill(r, 'png')
      else if (fmt === 'jpg') await exportStill(r, 'jpeg')
      else if (fmt === 'gif') await exportGif(r, { seconds, fps, onProgress: setProgress })
      else if (fmt === 'video') await recordVideo(r, { seconds, onProgress: setProgress })
      else if (fmt === 'svg') exportSvg(r)
      else if (fmt === 'txt') exportAsciiText(r)
    } catch (e) {
      console.error('export failed', e)
    } finally {
      setBusy(false); setProgress(0)
    }
  }
  async function copy() {
    const r = get(); if (!r) return
    if (await copyAsciiText(r)) { setCopied(true); setTimeout(() => setCopied(false), 1400) }
  }

  return (
    <Panel title="Export">
      <div className="grid grid-cols-3 gap-px bg-border">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFmt(f.id)}
            className={`px-1 py-1.5 text-left transition-colors ${fmt === f.id ? 'bg-accent text-black' : 'bg-surface text-fg-dim hover:bg-surface-2 hover:text-fg'}`}
          >
            <div className="text-[11px] font-medium">{f.label}</div>
            <div className={`text-[9px] ${fmt === f.id ? 'text-black/60' : 'text-faint'}`}>{f.ext}</div>
          </button>
        ))}
      </div>

      {(fmt === 'gif' || fmt === 'video') && (
        <div className="mt-2 space-y-0.5">
          <label className="flex h-6 items-center gap-2">
            <span className="label w-[84px]">Duration</span>
            <input type="range" className="filtr-range flex-1" min={1} max={fmt === 'gif' ? 8 : 15} step={1} value={seconds} onChange={(e) => setSeconds(+e.target.value)} />
            <span className="w-9 text-right tabular-nums text-fg-dim">{seconds}s</span>
          </label>
          {fmt === 'gif' && (
            <label className="flex h-6 items-center gap-2">
              <span className="label w-[84px]">FPS</span>
              <input type="range" className="filtr-range flex-1" min={5} max={24} step={1} value={fps} onChange={(e) => setFps(+e.target.value)} />
              <span className="w-9 text-right tabular-nums text-fg-dim">{fps}</span>
            </label>
          )}
        </div>
      )}

      {fmt === 'svg' && !svgOk && <p className="label mt-2 normal-case text-muted">SVG export: ASCII & Halftone only.</p>}
      {fmt === 'txt' && !txtOk && <p className="label mt-2 normal-case text-muted">Text export: ASCII only.</p>}
      {fmt === 'video' && !vidOk && <p className="label mt-2 normal-case text-muted">Recording unsupported here.</p>}

      {busy && (fmt === 'gif' || fmt === 'video') && (
        <div className="mt-2 h-0.5 w-full bg-surface-3"><div className="h-full bg-accent-ink" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      )}

      <div className="mt-2 flex gap-1">
        <button type="button" disabled={disabled} onClick={run} className="flex-1 bg-accent py-2 text-[11px] font-medium uppercase tracking-wider text-black transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-faint">
          {busy ? `Exporting ${Math.round(progress * 100) || ''}` : `Export ${fmt}`}
        </button>
        {fmt === 'txt' && txtOk && (
          <button type="button" disabled={!has} onClick={copy} title="Copy" className="flex w-9 items-center justify-center border border-border bg-surface text-fg-dim hover:text-fg disabled:opacity-40">
            {copied ? <Check2 /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </Panel>
  )
}

function Check2() {
  return <span className="text-accent-ink">✓</span>
}
