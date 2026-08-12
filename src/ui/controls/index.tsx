import { useStore } from '@/state/store'

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj)
}

export function useSetting<T>(path: string): [T, (v: T) => void] {
  const value = useStore((s) => getByPath(s.settings, path)) as T
  const setPath = useStore((s) => s.setPath)
  return [value, (v: T) => setPath(path, v)]
}

// ── slider ───────────────────────────────────────────────────────────────
export function Slider({
  path,
  label,
  min,
  max,
  step = 1,
  format,
}: {
  path: string
  label: string
  min: number
  max: number
  step?: number
  format?: (v: number) => string
}) {
  const [v, set] = useSetting<number>(path)
  const display = format ? format(v) : Number.isInteger(step) ? String(Math.round(v)) : v.toFixed(2)
  return (
    <label className="flex h-6 items-center gap-2">
      <span className="label w-[84px] shrink-0 truncate">{label}</span>
      <input
        type="range"
        className="filtr-range min-w-0 flex-1"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => set(parseFloat(e.target.value))}
      />
      <span className="w-9 shrink-0 text-right tabular-nums text-fg-dim">{display}</span>
    </label>
  )
}

// ── toggle (terminal checkbox) ─────────────────────────────────────────
export function Toggle({ path, label }: { path: string; label: string }) {
  const [v, set] = useSetting<boolean>(path)
  return (
    <button type="button" onClick={() => set(!v)} className="flex h-6 w-full items-center justify-between">
      <span className="label">{label}</span>
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center border text-[9px] leading-none ${
          v ? 'border-accent bg-accent text-black' : 'border-border-2 text-transparent'
        }`}
      >
        ×
      </span>
    </button>
  )
}

// ── segmented ──────────────────────────────────────────────────────────
export function Segmented<T extends string>({
  path,
  label,
  options,
}: {
  path: string
  label?: string
  options: { value: T; label: string }[]
}) {
  const [v, set] = useSetting<T>(path)
  return (
    <div className="py-1">
      {label && <div className="label mb-1">{label}</div>}
      <div className="flex flex-wrap gap-px border border-border bg-border">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => set(o.value)}
            className={`flex-1 whitespace-nowrap px-2 py-1 text-[11px] transition-colors ${
              v === o.value ? 'bg-accent text-black' : 'bg-surface text-fg-dim hover:bg-surface-2 hover:text-fg'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── select ───────────────────────────────────────────────────────────────
export function Select<T extends string>({
  path,
  label,
  options,
}: {
  path: string
  label: string
  options: { value: T; label: string }[]
}) {
  const [v, set] = useSetting<T>(path)
  return (
    <label className="flex h-7 items-center gap-2 py-1">
      <span className="label w-[84px] shrink-0">{label}</span>
      <select
        value={v}
        onChange={(e) => set(e.target.value as T)}
        className="min-w-0 flex-1 border border-border bg-surface-2 px-2 py-1 text-[11px] text-fg outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

// ── colour ────────────────────────────────────────────────────────────────
export function ColorInput({ path, label }: { path: string; label: string }) {
  const [v, set] = useSetting<string>(path)
  return (
    <div className="flex h-6 items-center justify-between">
      <span className="label">{label}</span>
      <label className="flex cursor-pointer items-center gap-2">
        <span className="tabular-nums uppercase text-faint">{v}</span>
        <span className="h-3.5 w-3.5 border border-border-2" style={{ background: v }}>
          <input type="color" value={v} onChange={(e) => set(e.target.value)} className="sr-only" />
        </span>
      </label>
    </div>
  )
}

// ── text ──────────────────────────────────────────────────────────────────
export function TextInput({ path, label, placeholder }: { path: string; label: string; placeholder?: string }) {
  const [v, set] = useSetting<string>(path)
  return (
    <label className="flex h-7 items-center gap-2 py-1">
      <span className="label w-[84px] shrink-0">{label}</span>
      <input
        type="text"
        value={v}
        placeholder={placeholder}
        onChange={(e) => set(e.target.value)}
        className="min-w-0 flex-1 border border-border bg-surface-2 px-2 py-1 text-[11px] text-fg outline-none focus:border-accent"
      />
    </label>
  )
}
