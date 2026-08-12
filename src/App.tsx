import { useEffect, useRef, useState } from 'react'
import { RendererProvider, useRenderer } from './ui/RendererProvider'
import { LeftRail } from './ui/LeftRail'
import { Preview } from './ui/Preview'
import { ControlRail } from './ui/ControlRail'
import { AboutModal } from './ui/AboutModal'

function Shell() {
  const { loadFile, get, play, pause } = useRenderer()
  const fileRef = useRef<HTMLInputElement>(null)
  const [about, setAbout] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'o' || e.key === 'O') { e.preventDefault(); fileRef.current?.click() }
      else if (e.key === ' ') {
        const src = get()?.source
        if (src?.isTimeBased) { e.preventDefault(); src.isPlaying ? pause() : play() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [get, play, pause])

  return (
    <div className="flex h-screen flex-col bg-bg text-fg">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="h-56 shrink-0 border-b border-border lg:h-auto lg:w-52 lg:border-b-0 lg:border-r">
          <LeftRail />
        </aside>
        <main className="relative flex min-h-[40vh] flex-1 lg:min-h-0">
          <Preview />
        </main>
        <aside className="h-[45vh] shrink-0 border-t border-border lg:h-auto lg:w-72 lg:border-l lg:border-t-0">
          <ControlRail />
        </aside>
      </div>
      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border px-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setAbout(true)} className="label hover:text-fg">About</button>
          <button type="button" onClick={() => setAbout(true)} className="label hover:text-fg">Changelog</button>
        </div>
        <span className="label">free · webgl2 · runs offline</span>
      </footer>
      <input ref={fileRef} type="file" accept="image/*,video/*,.gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = '' }} />
      {about && <AboutModal onClose={() => setAbout(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <RendererProvider>
      <Shell />
    </RendererProvider>
  )
}
