import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { DeepPartial, Settings, SourceKind } from './types'
import { DEFAULT_SETTINGS } from './defaults'

/** Lightweight, render-derived source metadata the UI reacts to. */
export interface SourceMeta {
  kind: SourceKind
  width: number
  height: number
  name: string | null
  /** time-based media */
  isPlaying: boolean
  duration: number // seconds, 0 for stills
  currentTime: number
  /** animated GIF frame info */
  frameCount: number
}

interface AppState {
  settings: Settings
  source: SourceMeta
  /** Bump to force a one-shot re-render of a still after settings change. */
  dirty: number

  /** Deep-set a single value by dotted path, e.g. "post.bloom.intensity". */
  setPath: (path: string, value: unknown) => void
  /** Apply a (partial) settings patch, merging over the current settings. */
  patch: (partial: DeepPartial<Settings>) => void
  /** Reset to defaults, then merge the preset patch (deterministic presets). */
  applyPreset: (partial: DeepPartial<Settings>) => void
  /** Replace all settings wholesale. */
  replace: (settings: Settings) => void
  reset: () => void
  setSource: (meta: Partial<SourceMeta>) => void
}

function deepMerge(target: any, patch: any) {
  for (const key of Object.keys(patch)) {
    const v = patch[key]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {}
      deepMerge(target[key], v)
    } else {
      target[key] = v
    }
  }
}

export const useStore = create<AppState>()(
  immer((set) => ({
    settings: structuredClone(DEFAULT_SETTINGS),
    source: {
      kind: 'none',
      width: 0,
      height: 0,
      name: null,
      isPlaying: false,
      duration: 0,
      currentTime: 0,
      frameCount: 0,
    },
    dirty: 0,

    setPath: (path, value) =>
      set((state) => {
        const keys = path.split('.')
        let obj: any = state.settings
        for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]]
        obj[keys[keys.length - 1]] = value
        state.dirty++
      }),

    patch: (partial) =>
      set((state) => {
        deepMerge(state.settings, partial)
        state.dirty++
      }),

    applyPreset: (partial) =>
      set((state) => {
        const base = structuredClone(DEFAULT_SETTINGS)
        deepMerge(base, partial)
        state.settings = base
        state.dirty++
      }),

    replace: (settings) =>
      set((state) => {
        state.settings = structuredClone(settings)
        state.dirty++
      }),

    reset: () =>
      set((state) => {
        state.settings = structuredClone(DEFAULT_SETTINGS)
        state.dirty++
      }),

    setSource: (meta) =>
      set((state) => {
        Object.assign(state.source, meta)
        state.dirty++
      }),
  })),
)

/** Imperative accessor for the render loop (avoids React re-render coupling). */
export const getSettings = () => useStore.getState().settings

if (import.meta.env.DEV) {
  ;(window as unknown as { __filtrStore?: typeof useStore }).__filtrStore = useStore
}
