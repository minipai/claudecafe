import './index.css'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { nowServing, speakThis } from './i18n'

// Before the first paint: the window is drawn in the machine's language unless
// the master has said otherwise, and in the browser there is only the browser's.
speakThis(window.cafe?.locale ?? navigator.language)
// Half the interface says her name; it is settled here so nothing has to draw
// once without it.
if (window.cafe?.maidName) nowServing(window.cafe.maidName)

createRoot(document.getElementById('root')!).render(<App />)
