import { X } from 'lucide-react'

const CHANGELOG: { v: string; date: string; notes: string[] }[] = [
  {
    v: '1.0',
    date: '2026',
    notes: [
      'Initial release — ASCII, dithering, halftone, edge, pixel-sort, matrix, wave & voronoi styles',
      'Image, video, GIF and webcam input',
      'Retro palettes, post-processing FX and a preset system',
      'PNG / JPG / GIF / video / SVG / text export',
    ],
  },
]

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / pause video'],
  ['O', 'Open a file'],
  ['Drag & drop', 'Load image / video / GIF'],
  ['Paste', 'Load image from clipboard'],
]

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--filtr-scrim)] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-2 bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-faint transition-colors hover:text-fg"
        >
          <X size={18} />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent font-mono text-xl font-bold text-black">
            f
          </span>
          <div>
            <h2 className="text-xl font-semibold text-fg">filtr</h2>
            <p className="font-mono text-[10px] uppercase tracking-wider text-faint">
              real-time retro effects studio
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-fg-dim">
          A free, fully client-side studio for turning images, video, GIFs and your
          webcam into ASCII art, dithered prints, halftones and retro screen effects —
          rendered live with WebGL2.
        </p>

        {/* Precise on purpose. "Nothing is uploaded" is true of the user's media
            and stays true — but implying no measurement at all while shipping an
            analytics beacon would turn an honest claim into a misleading one. */}
        <p className="mb-5 border-l-2 border-border-2 pl-3 text-sm leading-relaxed text-muted">
          Your images and video never leave your device — every effect runs on your
          own GPU. We count anonymous page views to know whether anyone is using
          filtr: no cookies, no cross-site tracking, no personal data, and nothing
          derived from your files.
        </p>

        <Section title="Keyboard shortcuts">
          <dl className="grid grid-cols-1 gap-1.5">
            {SHORTCUTS.map(([k, d]) => (
              <div key={k} className="flex items-center gap-3 text-sm">
                <kbd className="min-w-20 rounded border border-border bg-surface-2 px-2 py-0.5 text-center font-mono text-[11px] text-fg-dim">
                  {k}
                </kbd>
                <span className="text-muted">{d}</span>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Changelog">
          {CHANGELOG.map((c) => (
            <div key={c.v} className="mb-3">
              <p className="mb-1 font-mono text-xs text-fg-dim">
                v{c.v} <span className="text-faint">· {c.date}</span>
              </p>
              <ul className="ml-4 list-disc space-y-0.5 text-sm text-muted">
                {c.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ))}
        </Section>

        <p className="mt-4 border-t border-border pt-4 text-center font-mono text-[10px] uppercase tracking-wider text-faint">
          built with webgl2 · runs offline · open the same file anytime
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-dim">
        {title}
      </h3>
      {children}
    </section>
  )
}
