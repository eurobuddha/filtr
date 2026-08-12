import { useState } from 'react'

export function Panel({
  title,
  defaultOpen = true,
  right,
  children,
}: {
  title: string
  defaultOpen?: boolean
  right?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-border">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-1.5 px-3 py-2 text-left"
        >
          <span className="w-2 text-faint">{open ? '▾' : '▸'}</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-fg-dim">{title}</span>
        </button>
        {right && <div className="pr-3">{right}</div>}
      </div>
      {open && <div className="space-y-0.5 px-3 pb-3">{children}</div>}
    </section>
  )
}
