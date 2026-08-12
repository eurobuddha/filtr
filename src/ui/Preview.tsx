import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize2, Minus, Pause, Play, Plus } from 'lucide-react'
import { useRenderer } from './RendererProvider'
import { useStore } from '@/state/store'
import { EFFECT_LABELS, type EffectId } from '@/state/types'

function fmt(t: number) {
  if (!isFinite(t)) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Preview() {
  const { attach, error, ready, loadFile, play, pause, seek, get } = useRenderer()
  const [drag, setDrag] = useState(false)
  const [time, setTime] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const panning = useRef<{ x: number; y: number } | null>(null)

  const source = useStore((s) => s.source)
  const active = useStore((s) => s.settings.active)
  const showOriginal = useStore((s) => s.settings.output.showOriginal)
  const has = source.kind !== 'none'
  const isVideo = source.kind === 'video' || source.kind === 'webcam'
  const isTimeBased = isVideo || source.kind === 'gif'
  const fatal = !ready && !!error

  useEffect(() => {
    if (!isVideo) return
    const id = setInterval(() => { const r = get(); if (r) setTime(r.source.currentTime) }, 250)
    return () => clearInterval(id)
  }, [isVideo, get])

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      const f = item?.getAsFile()
      if (f) void loadFile(f)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [loadFile])

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])

  function onWheel(e: React.WheelEvent) {
    if (!has) return
    const dz = e.deltaY < 0 ? 1.12 : 1 / 1.12
    setZoom((z) => Math.min(8, Math.max(0.2, z * dz)))
  }
  function onPointerDown(e: React.PointerEvent) {
    if (!has || zoom <= 1) return
    panning.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!panning.current) return
    setPan({ x: e.clientX - panning.current.x, y: e.clientY - panning.current.y })
  }
  function onPointerUp() { panning.current = null }

  function fullscreen() {
    const el = wrapRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen?.()
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-bg">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="label flex items-center gap-2">
          <span className="text-accent-ink">{EFFECT_LABELS[active as EffectId]}</span>
          <span className="text-faint">[WEBGL2]</span>
        </span>
        <span className="label">{has ? `${source.width}×${source.height}` : '—'}</span>
      </div>

      <div
        ref={wrapRef}
        className="dotgrid relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-bg p-6"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void loadFile(f) }}
        style={{ cursor: has && zoom > 1 ? 'grab' : 'default' }}
      >
        <canvas
          ref={attach}
          className={`filtr-checker max-h-full max-w-full ${has ? 'block' : 'hidden'}`}
          style={{ objectFit: 'contain', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, imageRendering: zoom > 1.5 ? 'pixelated' : 'auto' }}
        />
        {/* Badge sits over the user's artwork, which can be any colour — the
            scrim stays dark in both themes, so its ink is pinned to match. */}
        {showOriginal && has && (
          <div className="pointer-events-none absolute left-8 top-8 bg-black/80 px-1.5 py-0.5 label text-[var(--filtr-badge-fg)]">original</div>
        )}
        {!has && !fatal && (
          <div className="text-center">
            <p className="text-[13px] text-fg-dim">Awaiting input</p>
            <p className="label mt-1">drop a file or select a source</p>
          </div>
        )}
        {fatal && (
          <div className="max-w-sm border border-bad/40 bg-bad/5 p-5 text-center">
            <p className="text-[13px] text-fg">WebGL2 unavailable</p>
            <p className="label mt-2 normal-case text-muted">filtr needs WebGL2. Try a recent Chrome, Edge, Firefox or Safari with hardware acceleration enabled.</p>
          </div>
        )}
        {drag && <div className="pointer-events-none absolute inset-2 border border-dashed border-accent-ink" />}
        {error && !fatal && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 border border-bad/40 bg-bad/10 px-3 py-1 text-[11px] text-bad">{error}</div>
        )}

        {/* zoom controls */}
        {has && (
          <div className="absolute bottom-3 right-3 flex items-center gap-px bg-surface/90 backdrop-blur">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))} className="flex h-6 w-6 items-center justify-center text-fg-dim hover:text-accent-ink"><Minus size={12} /></button>
            <button type="button" onClick={resetView} className="label w-12 text-center tabular-nums hover:text-fg">{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => setZoom((z) => Math.min(8, z * 1.2))} className="flex h-6 w-6 items-center justify-center text-fg-dim hover:text-accent-ink"><Plus size={12} /></button>
            <button type="button" onClick={fullscreen} className="flex h-6 w-6 items-center justify-center text-fg-dim hover:text-accent-ink" title="Fullscreen"><Maximize2 size={12} /></button>
          </div>
        )}
      </div>

      {isTimeBased && (
        <div className="flex h-9 shrink-0 items-center gap-3 border-t border-border px-3">
          <button type="button" onClick={() => (source.isPlaying ? pause() : play())} className="text-fg-dim hover:text-accent-ink">
            {source.isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          {isVideo && source.duration > 0 && (
            <>
              <span className="label tabular-nums">{fmt(time)}</span>
              <input type="range" className="filtr-range flex-1" min={0} max={source.duration} step={0.05} value={time} onChange={(e) => { const t = parseFloat(e.target.value); setTime(t); seek(t) }} />
              <span className="label tabular-nums">{fmt(source.duration)}</span>
            </>
          )}
          {source.kind === 'webcam' && <span className="label text-accent-ink">● live</span>}
        </div>
      )}
    </div>
  )
}
