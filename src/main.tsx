import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Note: no <StrictMode> — it double-invokes effects in dev, which would
// initialise the WebGL2 context and render loop twice. The renderer owns a
// single long-lived GL context, so we mount once.
createRoot(document.getElementById('root')!).render(<App />)
