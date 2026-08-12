import type { Renderer } from '@/engine/renderer'
import { downloadBlob, timestamp } from '@/lib/download'

export async function exportStill(
  renderer: Renderer,
  format: 'png' | 'jpeg',
  quality = 0.92,
) {
  // freeze the live loop so it can't repaint between render and toBlob
  renderer.stop()
  try {
    renderer.renderNow()
    const canvas = renderer.gl.canvas as HTMLCanvasElement
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, format === 'png' ? 'image/png' : 'image/jpeg', quality),
    )
    if (!blob) throw new Error('Failed to create image blob')
    downloadBlob(blob, `filtr-${timestamp()}.${format === 'png' ? 'png' : 'jpg'}`)
  } finally {
    renderer.start()
  }
}
