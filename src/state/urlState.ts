// ─────────────────────────────────────────────────────────────────────────
// URL state: deep links and shareable looks.
//
// Two mechanisms, deliberately split:
//   ?fx=<effectId> / ?p=<presetId>  — query, so analytics can attribute an
//                                     entry point to a conversion.
//   #s=<codec>                      — fragment, which is never sent to the
//                                     server and is stripped from Referer.
//                                     A shared look genuinely never touches
//                                     any server, the same promise already
//                                     made about the user's images.
//
// Precedence: #s > ?p > ?fx. Apply one, ignore the rest.
// ─────────────────────────────────────────────────────────────────────────

import type { DeepPartial, Settings } from './types'
import { EFFECT_ORDER, type EffectId } from './types'
import { DEFAULT_SETTINGS } from './defaults'
import { BUILTIN_PRESETS } from './presets'

const VERSION = '1'
const CODEC_DEFLATE = 'z'
const CODEC_PLAIN = 'u'

// ── diff ─────────────────────────────────────────────────────────────────

/** #rgb / #rrggbb / #rrggbbaa — the shape every colour setting uses. */
const HEX = /^#[0-9a-fA-F]{3,8}$/

type Obj = Record<string, unknown>
const isPlainObject = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Keep only leaves that differ from the defaults. `active` is always kept. */
export function diffFromDefaults(settings: Settings): DeepPartial<Settings> {
  const walk = (cur: Obj, base: Obj): Obj => {
    const out: Obj = {}
    for (const key of Object.keys(cur)) {
      const a = cur[key]
      const b = base[key]
      if (isPlainObject(a) && isPlainObject(b)) {
        const nested = walk(a, b)
        if (Object.keys(nested).length) out[key] = nested
      } else if (a !== b) {
        out[key] = a
      }
    }
    return out
  }
  const diff = walk(settings as unknown as Obj, DEFAULT_SETTINGS as unknown as Obj)
  diff.active = settings.active // always pin the effect, even at its default
  return diff as DeepPartial<Settings>
}

// ── sanitiser ────────────────────────────────────────────────────────────

/**
 * Validate a decoded payload against DEFAULT_SETTINGS as the schema.
 *
 * This is a security boundary, not a nicety: store.deepMerge writes any key it
 * is handed straight into settings, and export/svg.ts interpolates settings
 * values into SVG markup. A key is accepted only if it exists in the schema and
 * its typeof matches. Everything else is dropped silently.
 */
export function sanitisePatch(raw: unknown): DeepPartial<Settings> {
  if (!isPlainObject(raw)) return {}

  const walk = (cur: Obj, schema: Obj): Obj => {
    const out: Obj = {}
    for (const key of Object.keys(cur)) {
      if (!Object.prototype.hasOwnProperty.call(schema, key)) continue
      const v = cur[key]
      const s = schema[key]
      if (isPlainObject(s)) {
        if (isPlainObject(v)) {
          const nested = walk(v, s)
          if (Object.keys(nested).length) out[key] = nested
        }
        continue
      }
      if (typeof v !== typeof s) continue
      if (typeof v === 'number' && !Number.isFinite(v)) continue
      // Schema-driven colour check: if the default is a hex colour, the incoming
      // value must be one too. export/svg.ts interpolates these straight into
      // fill="..." attributes, so an arbitrary string here would let a crafted
      // share link produce a booby-trapped SVG download.
      if (typeof v === 'string' && HEX.test(s as string) && !HEX.test(v)) continue
      out[key] = v
    }
    return out
  }

  const clean = walk(raw, DEFAULT_SETTINGS as unknown as Obj)
  // `active` drives a switch in the renderer — constrain it to known effects.
  if ('active' in clean && !EFFECT_ORDER.includes(clean.active as EffectId)) {
    delete clean.active
  }
  return clean as DeepPartial<Settings>
}

// ── base64url ────────────────────────────────────────────────────────────

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function squeeze(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

// ── encode / decode ──────────────────────────────────────────────────────

/**
 * Encode the current settings as a compact fragment payload.
 * Format: `<version><codec><base64url>` e.g. `1zq1Yc…`
 */
export async function encodeSettings(settings: Settings): Promise<string> {
  const json = JSON.stringify(diffFromDefaults(settings))
  const bytes = new TextEncoder().encode(json)
  if (typeof CompressionStream === 'undefined') {
    return VERSION + CODEC_PLAIN + toBase64Url(bytes)
  }
  const cs = new CompressionStream('deflate-raw')
  const packed = await squeeze(new Blob([bytes as BufferSource]).stream().pipeThrough(cs))
  return VERSION + CODEC_DEFLATE + toBase64Url(packed)
}

/** Decode a fragment payload. Returns {} for anything malformed. */
export async function decodeSettings(payload: string): Promise<DeepPartial<Settings>> {
  try {
    if (payload.length < 3 || payload[0] !== VERSION) return {}
    const codec = payload[1]
    const body = fromBase64Url(payload.slice(2))
    let bytes: Uint8Array
    if (codec === CODEC_DEFLATE) {
      if (typeof DecompressionStream === 'undefined') return {}
      const ds = new DecompressionStream('deflate-raw')
      bytes = await squeeze(new Blob([body as BufferSource]).stream().pipeThrough(ds))
    } else if (codec === CODEC_PLAIN) {
      bytes = body
    } else {
      return {}
    }
    return sanitisePatch(JSON.parse(new TextDecoder().decode(bytes)))
  } catch {
    return {}
  }
}

// ── reading the current URL ──────────────────────────────────────────────

/** Synchronous entry points: `?p=<preset>` then `?fx=<effect>`. */
export function readQueryPatch(search = window.location.search): DeepPartial<Settings> | null {
  const q = new URLSearchParams(search)
  const presetId = q.get('p')
  if (presetId) {
    const preset = BUILTIN_PRESETS.find((x) => x.id === presetId)
    if (preset) return preset.settings
  }
  const fx = q.get('fx')
  if (fx && EFFECT_ORDER.includes(fx as EffectId)) return { active: fx as EffectId }
  return null
}

/** True when the URL asks for any specific look — used to auto-load the demo. */
export function hasDeepLink(loc: Location = window.location): boolean {
  const q = new URLSearchParams(loc.search)
  return q.has('p') || q.has('fx') || loc.hash.startsWith('#s=')
}

/** Async entry point: `#s=<codec>`. Takes precedence over the query params. */
export async function readFragmentPatch(hash = window.location.hash): Promise<DeepPartial<Settings> | null> {
  if (!hash.startsWith('#s=')) return null
  const patch = await decodeSettings(hash.slice(3))
  return Object.keys(patch).length ? patch : null
}

/** Build a shareable absolute URL for the given settings. */
export async function buildShareUrl(settings: Settings): Promise<string> {
  const payload = await encodeSettings(settings)
  return `${window.location.origin}${window.location.pathname}#s=${payload}`
}

/**
 * Drop the state params from the address bar once applied. A stale link that no
 * longer describes what is on screen is worse than no link at all.
 */
export function clearUrlState() {
  history.replaceState(null, '', window.location.pathname)
}
