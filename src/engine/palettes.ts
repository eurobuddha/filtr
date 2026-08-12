export interface PaletteDef {
  id: string
  name: string
  /** Ordered dark → light. */
  colors: string[]
}

// Retro palettes used by the dithering "indexed" colour mode.
export const PALETTES: PaletteDef[] = [
  { id: 'none', name: 'None', colors: [] },
  { id: 'grayscale', name: 'Grayscale', colors: ['#000000', '#ffffff'] },
  { id: 'gameboy', name: 'GameBoy', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
  { id: 'amber', name: 'Amber', colors: ['#1a0d00', '#7a3d00', '#ff9d1c', '#ffe2a8'] },
  { id: 'green', name: 'Phosphor', colors: ['#001200', '#0c5c20', '#39ff5a', '#ccffd6'] },
  { id: 'c64', name: 'Microcomputer', colors: ['#1a1a3d', '#5c4bd1', '#9a86fc', '#cfc6ff'] },
  { id: 'newspaper', name: 'Newsprint', colors: ['#15140f', '#5a564a', '#b8b09a', '#f4f1e3'] },
  { id: 'riso', name: 'Risograph', colors: ['#2a2438', '#d6336c', '#f06595', '#f7eede'] },
  { id: 'cyberpunk', name: 'Cyberpunk', colors: ['#0a0118', '#ff2a6d', '#05d9e8', '#d1f7ff'] },
  { id: 'sepia', name: 'Sepia', colors: ['#241606', '#7a5230', '#d8b98a', '#f4ecd8'] },
]

export function paletteById(id: string): PaletteDef {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[1]
}
