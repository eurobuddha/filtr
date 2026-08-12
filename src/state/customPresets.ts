import type { Preset, Settings } from './types'

const KEY = 'filtr.presets.v1'

export function loadCustomPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(presets: Preset[]) {
  localStorage.setItem(KEY, JSON.stringify(presets))
}

export function saveCustomPreset(name: string, settings: Settings): Preset[] {
  const presets = loadCustomPresets()
  const preset: Preset = {
    id: `custom-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    name: name.trim() || 'Untitled',
    settings: structuredClone(settings),
  }
  const next = [...presets, preset]
  persist(next)
  return next
}

export function deleteCustomPreset(id: string): Preset[] {
  const next = loadCustomPresets().filter((p) => p.id !== id)
  persist(next)
  return next
}

export function exportPresets(): string {
  return JSON.stringify(loadCustomPresets(), null, 2)
}

export function importPresets(json: string): Preset[] {
  const parsed = JSON.parse(json)
  if (!Array.isArray(parsed)) throw new Error('Invalid preset file')
  const existing = loadCustomPresets()
  const merged = [...existing]
  for (const p of parsed as Preset[]) {
    if (p && p.settings && p.name) {
      merged.push({ ...p, id: `custom-${Date.now()}-${Math.floor(Math.random() * 1e6)}` })
    }
  }
  persist(merged)
  return merged
}
