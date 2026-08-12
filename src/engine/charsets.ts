// ASCII charsets, ordered LIGHT → DENSE (space first), exactly as grainrad.
// Mapping in the shader: index = floor(luma * count) → bright pixels get the
// dense glyphs at the end.

export interface Charset {
  id: string
  name: string
  chars: string
}

export const CHARSETS: Charset[] = [
  { id: 'standard', name: 'STANDARD', chars: ' .:-=+*#%@' },
  { id: 'blocks', name: 'BLOCKS', chars: ' ░▒▓█' },
  { id: 'binary', name: 'BINARY', chars: ' 01' },
  {
    id: 'detailed',
    name: 'DETAILED',
    chars:
      " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  },
  { id: 'minimal', name: 'MINIMAL', chars: ' .:#' },
  { id: 'alphabetic', name: 'ALPHABETIC', chars: ' .icotCOXWM' },
  { id: 'numeric', name: 'NUMERIC', chars: ' 1234567890' },
  { id: 'math', name: 'MATH', chars: ' .-+×÷=≠<>≤≥∞∑∏√∫' },
  { id: 'emoji', name: 'SYMBOLS', chars: ' ·•○◎●◐◑◒◓◔◕◖◗' },
  { id: 'custom', name: 'CUSTOM', chars: ' .:+*#@' },
]

export function charsetById(id: string): Charset {
  return CHARSETS.find((c) => c.id === id) ?? CHARSETS[0]
}

export function resolveChars(id: string, custom: string): string {
  if (id === 'custom') return custom.length ? custom : ' '
  return charsetById(id).chars
}
