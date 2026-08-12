// ─────────────────────────────────────────────────────────────────────────
// UI theme preference. Deliberately NOT part of `Settings`:
//   - store.reset() / applyPreset() rebuild settings from DEFAULT_SETTINGS,
//     which would wipe the theme on reset and on every preset load;
//   - saveCustomPreset() clones settings into localStorage and exportPresets()
//     ships it as JSON, so the theme would leak into shared preset files;
//   - every store mutator bumps `dirty`, forcing a WebGL repaint.
// This module is pure DOM + localStorage and never touches the renderer.
// ─────────────────────────────────────────────────────────────────────────

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

/** Keep in sync with the pre-paint bootstrap in index.html. */
const KEY = 'filtr.theme.v1'

const MODES: ThemeMode[] = ['system', 'light', 'dark']

/** Mirrors --color-bg per theme, for the address-bar tint on mobile. */
const META_BG: Record<ResolvedTheme, string> = { dark: '#0a0a0a', light: '#f2f1ec' }

export function loadTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(KEY)
    return MODES.includes(raw as ThemeMode) ? (raw as ThemeMode) : 'system'
  } catch {
    return 'system'
  }
}

function persist(mode: ThemeMode) {
  // setItem throws in Safari private mode and sandboxed iframes; a lost
  // preference is not worth breaking the toggle over.
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* non-fatal — theme stays for the session */
  }
}

const query = () => window.matchMedia('(prefers-color-scheme: light)')

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? (query().matches ? 'light' : 'dark') : mode
}

/**
 * Write the resolved theme to the DOM. `data-theme` always holds 'light' or
 * 'dark' — never 'system' — so the stylesheet needs one selector and no
 * prefers-color-scheme block, and the screenshot harness can force a theme
 * with a single DOM write.
 */
export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode)
  document.documentElement.dataset.theme = resolved
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', META_BG[resolved])
  return resolved
}

export function setTheme(mode: ThemeMode): ThemeMode {
  persist(mode)
  applyTheme(mode)
  return mode
}

/** system → light → dark → system */
export function nextTheme(mode: ThemeMode): ThemeMode {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length]
}

/** Subscribe to OS changes; returns an unsubscribe. */
export function watchSystem(onChange: () => void): () => void {
  const q = query()
  q.addEventListener('change', onChange)
  return () => q.removeEventListener('change', onChange)
}
