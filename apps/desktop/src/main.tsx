import './index.css'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { speakThis } from './i18n'

// Before the first paint: the window is drawn in the machine's language unless
// the master has said otherwise, and in the browser there is only the browser's.
speakThis(window.cafe?.locale ?? navigator.language)

createRoot(document.getElementById('root')!).render(<App />)
