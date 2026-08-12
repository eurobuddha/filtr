import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Renderer } from '@/engine/renderer'
import { useStore } from '@/state/store'

interface RendererApi {
  ready: boolean
  error: string | null
  attach: (canvas: HTMLCanvasElement | null) => void
  get: () => Renderer | null
  loadFile: (file: File) => Promise<void>
  startWebcam: () => Promise<void>
  play: () => void
  pause: () => void
  seek: (t: number) => void
}

const Ctx = createContext<RendererApi | null>(null)

export function useRenderer(): RendererApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useRenderer must be used within RendererProvider')
  return ctx
}

export function RendererProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<Renderer | null>(null)
  const loadingRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setSource = useStore((s) => s.setSource)

  // Tear down the GL context, render loop, webcam stream etc. on unmount.
  useEffect(() => {
    return () => {
      ref.current?.dispose()
      ref.current = null
    }
  }, [])

  const attach = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas || ref.current) return
      try {
        const r = new Renderer(canvas)
        r.start()
        ref.current = r
        setReady(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [],
  )

  const syncMeta = useCallback(() => {
    const r = ref.current
    if (!r) return
    setSource({
      kind: r.source.kind,
      width: r.source.width,
      height: r.source.height,
      name: r.source.name,
      isPlaying: r.source.isPlaying,
      duration: r.source.duration,
      currentTime: r.source.currentTime,
      frameCount: r.source.frameCount,
    })
  }, [setSource])

  const loadFile = useCallback(
    async (file: File) => {
      const r = ref.current
      if (!r || loadingRef.current) return
      loadingRef.current = true
      setError(null)
      try {
        const type = file.type
        if (type === 'image/gif') await r.source.loadGif(file)
        else if (type.startsWith('image/')) await r.source.loadImage(file)
        else if (type.startsWith('video/')) await r.source.loadVideo(file)
        else if (/\.(png|jpe?g|webp|bmp|avif)$/i.test(file.name))
          await r.source.loadImage(file)
        else if (/\.gif$/i.test(file.name)) await r.source.loadGif(file)
        else if (/\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name))
          await r.source.loadVideo(file)
        else throw new Error('Unsupported file type')
        r.renderNow()
        syncMeta()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to process file')
      } finally {
        loadingRef.current = false
      }
    },
    [syncMeta],
  )

  const startWebcam = useCallback(async () => {
    const r = ref.current
    if (!r || loadingRef.current) return
    loadingRef.current = true
    setError(null)
    try {
      await r.source.startWebcam()
      syncMeta()
    } catch {
      setError('Camera access failed')
    } finally {
      loadingRef.current = false
    }
  }, [syncMeta])

  const play = useCallback(() => {
    ref.current?.source.play()
    syncMeta()
  }, [syncMeta])
  const pause = useCallback(() => {
    ref.current?.source.pause()
    syncMeta()
  }, [syncMeta])
  const seek = useCallback(
    (t: number) => {
      ref.current?.source.seek(t)
      syncMeta()
    },
    [syncMeta],
  )

  // Dev-only test hook so the visual harness can inject a source.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __filtrLoadFile?: typeof loadFile }).__filtrLoadFile = loadFile
  }, [loadFile])

  const api = useMemo<RendererApi>(
    () => ({
      ready,
      error,
      attach,
      get: () => ref.current,
      loadFile,
      startWebcam,
      play,
      pause,
      seek,
    }),
    [ready, error, attach, loadFile, startWebcam, play, pause, seek],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
