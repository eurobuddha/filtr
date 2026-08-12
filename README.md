# filtr

**Real-time retro effects studio.** Turn images, video, GIFs and your webcam into
ASCII art, dithered prints, halftones and CRT/retro screen effects — rendered live
with WebGL2, entirely in the browser. Nothing is uploaded.

## Features

- **Render styles:** ASCII (custom charsets), dithering (Floyd–Steinberg, Atkinson,
  Burkes, Stucki, Sierra, Bayer 2/4/8/16, clustered-dot, blue-noise, interleaved
  gradient), halftone (circle/square/diamond/line), dots (square & hex grids),
  edge detection (Sobel, Prewitt, Laplacian, crosshatch, contour), pixel sort,
  matrix rain, wave lines, Voronoi mosaic.
- **Inputs:** image · video · animated GIF · webcam.
- **Colour:** brightness/contrast/saturation/hue/gamma/posterize/invert, plus retro
  palettes (Amber, Phosphor, GameBoy, Risograph, Cyberpunk, Sepia, Newsprint, custom…).
- **Post-processing:** bloom, glow, chromatic aberration, CRT curve, scanlines,
  vignette, film grain (white/perlin/simplex/worley).
- **Presets:** a dozen built-ins plus save / import / export of your own.
- **Export:** PNG, JPG, animated GIF, video (MP4/WebM), SVG vector, and ASCII text.
- **PWA:** installable and works offline.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

### Visual test harness

The WebGL output is verified with headless Chromium (SwiftShader):

```bash
npm run dev &                 # in one shell
node scripts/shoot.mjs        # screenshots every style + preset to /tmp/filtr-shots
node scripts/export-test.mjs  # verifies PNG / GIF / SVG / text exports
node scripts/gen-icons.mjs    # regenerate app icons + social preview
```

## Tech

Vite · React · TypeScript · Tailwind CSS · WebGL2 (GLSL ES 3.00) · Zustand · vite-plugin-pwa.
The renderer is a dependency-free, imperative GLSL pass pipeline (`src/engine`)
decoupled from React; UI state lives in a Zustand store.

## Deploy

Static SPA — any static host works. Configs are included for **Vercel**
(`vercel.json`) and **Netlify** (`netlify.toml`). Build with `npm run build`,
serve `dist/`.

## License

MIT — original work; not affiliated with any other effects tool.
