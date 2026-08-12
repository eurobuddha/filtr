import { EFFECT_LABELS, EFFECT_ORDER, type EffectId } from '@/state/types'
import { useSetting } from '../controls'

export function EffectList() {
  const [active, setActive] = useSetting<EffectId>('active')
  return (
    <div className="py-1">
      {EFFECT_ORDER.map((id) => {
        const on = active === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`flex w-full items-center gap-2 px-3 py-1 text-left text-[12px] transition-colors ${
              on ? 'bg-surface-2 text-accent' : 'text-fg-dim hover:bg-surface hover:text-fg'
            }`}
          >
            <span className={`text-[8px] leading-none ${on ? 'text-accent' : 'text-transparent'}`}>●</span>
            <span className={on ? 'font-medium' : ''}>{EFFECT_LABELS[id]}</span>
          </button>
        )
      })}
    </div>
  )
}
