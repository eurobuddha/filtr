import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import {
  applyTheme,
  loadTheme,
  nextTheme,
  setTheme,
  watchSystem,
  type ThemeMode,
} from '@/state/theme'

const ICON = { system: Monitor, light: Sun, dark: Moon }

/**
 * Cycles system → light → dark. Deliberately not built on the `Toggle`
 * primitive in ui/controls: that one is bound to `useSetting(path)`, which
 * writes to the settings store and would repaint the canvas on every click.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => loadTheme())

  useEffect(() => {
    applyTheme(mode)
  }, [mode])

  // Only follow the OS while the user hasn't picked an explicit theme.
  useEffect(
    () => (mode === 'system' ? watchSystem(() => applyTheme('system')) : undefined),
    [mode],
  )

  const Icon = ICON[mode]
  return (
    <button
      type="button"
      onClick={() => setMode(setTheme(nextTheme(mode)))}
      title={`Theme: ${mode} — click to cycle`}
      className="label flex items-center gap-1.5 hover:text-fg"
    >
      <Icon size={11} />
      {mode}
    </button>
  )
}
