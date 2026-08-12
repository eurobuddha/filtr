import { useRef, useState } from 'react'
import { Check, Download, Plus, Trash2, Upload } from 'lucide-react'
import { Panel } from './Panel'
import { useStore } from '@/state/store'
import { BUILTIN_PRESETS } from '@/state/presets'
import {
  deleteCustomPreset,
  exportPresets,
  importPresets,
  loadCustomPresets,
  saveCustomPreset,
} from '@/state/customPresets'
import type { Preset } from '@/state/types'

export function PresetsPanel() {
  const applyPreset = useStore((s) => s.applyPreset)
  const [custom, setCustom] = useState<Preset[]>(() => loadCustomPresets())
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function save() {
    setCustom(saveCustomPreset(name, useStore.getState().settings))
    setName('')
    setNaming(false)
  }
  function doExport() {
    const blob = new Blob([exportPresets()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'filtr-presets.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  async function doImport(file: File) {
    try {
      setCustom(importPresets(await file.text()))
    } catch {
      /* ignore */
    }
  }

  return (
    <Panel title="Presets" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-px bg-border">
        {BUILTIN_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p.settings)}
            className="bg-surface px-2 py-1.5 text-left text-[11px] text-fg-dim transition-colors hover:bg-surface-2 hover:text-accent"
          >
            {p.name}
          </button>
        ))}
      </div>

      {custom.length > 0 && (
        <div className="mt-2 space-y-px">
          <div className="label mb-1">Saved</div>
          {custom.map((p) => (
            <div key={p.id} className="flex items-center gap-1 bg-surface px-2 py-1">
              <button type="button" onClick={() => applyPreset(p.settings)} className="flex-1 truncate text-left text-[11px] text-fg-dim hover:text-fg">
                {p.name}
              </button>
              <button type="button" onClick={() => setCustom(deleteCustomPreset(p.id))} className="text-faint hover:text-bad">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2">
        {naming ? (
          <div className="flex gap-1">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="name" className="min-w-0 flex-1 border border-border bg-surface-2 px-2 py-1 text-[11px] outline-none focus:border-accent" />
            <button type="button" onClick={save} className="flex h-6 w-6 items-center justify-center bg-accent text-black">
              <Check size={12} />
            </button>
          </div>
        ) : (
          <div className="flex gap-1">
            <button type="button" onClick={() => setNaming(true)} className="flex flex-1 items-center justify-center gap-1 border border-border bg-surface py-1 text-[11px] text-fg-dim hover:border-border-2 hover:text-fg">
              <Plus size={12} /> Save
            </button>
            <button type="button" onClick={doExport} title="Export" className="flex h-6 w-6 items-center justify-center border border-border bg-surface text-fg-dim hover:text-fg">
              <Download size={12} />
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} title="Import" className="flex h-6 w-6 items-center justify-center border border-border bg-surface text-fg-dim hover:text-fg">
              <Upload size={12} />
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = '' }} />
          </div>
        )}
      </div>
    </Panel>
  )
}
