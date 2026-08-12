import { EffectSettings } from './panels/EffectSettings'
import { AdjustmentsPanel, ColorPanel, OutputPanel, PostPanel, ProcessingPanel } from './panels/GlobalPanels'
import { ExportPanel } from './panels/ExportPanel'
import { useStore } from '@/state/store'

export function ControlRail() {
  const reset = useStore((s) => s.reset)
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-fg-dim">Settings</span>
        <button type="button" onClick={reset} className="label hover:text-accent-ink">reset</button>
      </div>
      <EffectSettings />
      <AdjustmentsPanel />
      <ColorPanel />
      <ProcessingPanel />
      <PostPanel />
      <OutputPanel />
      <ExportPanel />
    </div>
  )
}
