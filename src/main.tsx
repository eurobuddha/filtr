import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useStore } from './state/store.ts'
import { readQueryPatch } from './state/urlState.ts'

// ?p / ?fx are synchronous, so apply them before the first render. The async
// #s fragment is handled in App, where it can await DecompressionStream.
// No flash either way: with no source loaded the canvas shows the empty state
// regardless of what the settings say.
const queryPatch = readQueryPatch()
if (queryPatch) useStore.getState().applyPreset(queryPatch)

// Note: no <StrictMode> — it double-invokes effects in dev, which would
// initialise the WebGL2 context and render loop twice. The renderer owns a
// single long-lived GL context, so we mount once.
createRoot(document.getElementById('root')!).render(<App />)
