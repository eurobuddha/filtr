import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { Panel } from './Panel'
import { useRenderer } from '../RendererProvider'
import { useStore } from '@/state/store'

export function InputPanel() {
  const { loadFile, startWebcam } = useRenderer()
  const source = useStore((s) => s.source)
  const fileRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const has = source.kind !== 'none'

  return (
    <Panel title="Input">
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void loadFile(f) }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 border border-dashed py-4 text-center transition-colors ${
          drag ? 'border-accent bg-accent/5' : 'border-border-2 hover:border-faint'
        }`}
      >
        <span className="text-[11px] text-fg-dim">Drop file or click to browse</span>
        <span className="label">PNG · JPG · GIF · MP4 · WEBM</span>
      </div>
      <button
        type="button"
        onClick={() => void startWebcam()}
        className="mt-1 flex w-full items-center justify-center gap-1.5 border border-border bg-surface py-1.5 text-[11px] text-fg-dim hover:border-border-2 hover:text-fg"
      >
        <Camera size={12} /> Webcam
      </button>
      <div className="mt-2 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 ${has ? 'bg-accent' : 'bg-faint'}`} />
        <span className="label">
          {has ? `${source.width}×${source.height}${source.kind !== 'image' ? ` · ${source.kind}` : ''}` : 'Standby'}
        </span>
      </div>
      <input ref={fileRef} type="file" accept="image/*,video/*,.gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = '' }} />
    </Panel>
  )
}
