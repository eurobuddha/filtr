import { InputPanel } from './panels/InputPanel'
import { EffectList } from './panels/EffectList'
import { PresetsPanel } from './panels/PresetsPanel'
import { Panel } from './panels/Panel'

export function LeftRail() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="flex h-4 w-4 items-center justify-center bg-accent text-[11px] font-bold leading-none text-black">f</span>
        <span className="text-[13px] font-semibold tracking-tight text-fg">filtr</span>
      </div>
      <InputPanel />
      <Panel title="Effects">
        <div className="-mx-3 -mb-1">
          <EffectList />
        </div>
      </Panel>
      <PresetsPanel />
    </div>
  )
}
