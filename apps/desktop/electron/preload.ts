import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { BridgeEvent, CafeBridge } from '../src/agent/bridge'

const folderArg = process.argv.find((arg) => arg.startsWith('--cafe-cwd=')) ?? ''
const localeArg = process.argv.find((arg) => arg.startsWith('--cafe-locale=')) ?? ''
const choiceArg = process.argv.find((arg) => arg.startsWith('--cafe-locale-choice=')) ?? ''
const backdropArg = process.argv.find((arg) => arg.startsWith('--cafe-backdrop=')) ?? ''

const bridge: CafeBridge = {
  cwd: folderArg.slice('--cafe-cwd='.length),
  locale: localeArg.slice('--cafe-locale='.length),
  localeChoice: choiceArg.slice('--cafe-locale-choice='.length),
  setLocale: (choice) => ipcRenderer.send('cafe:set-locale', choice),
  setSpeech: (language) => ipcRenderer.send('cafe:set-speech', language),
  // Handed over as one string and split here, so the window has something to
  // draw on its very first frame rather than a flash of nothing behind her.
  backdrop: {
    scene: backdropArg.slice('--cafe-backdrop='.length).split('/')[0] || 'mucha',
    edge: backdropArg.slice('--cafe-backdrop='.length).split('/')[1] || 'none',
  },
  setBackdrop: (chosen) => ipcRenderer.send('cafe:set-backdrop', chosen),
  start: (runId, prompt, images) => ipcRenderer.send('cafe:start', runId, prompt, images),
  answer: (askId, value) => ipcRenderer.send('cafe:answer', askId, value),
  interrupt: () => ipcRenderer.send('cafe:interrupt'),
  newSession: () => ipcRenderer.send('cafe:new-session'),
  refresh: () => ipcRenderer.send('cafe:refresh'),
  configure: (patch) => ipcRenderer.send('cafe:configure', patch),
  signIn: () => ipcRenderer.send('cafe:sign-in'),
  reconnect: () => ipcRenderer.send('cafe:reconnect'),
  usage: () => ipcRenderer.invoke('cafe:usage'),
  context: () => ipcRenderer.invoke('cafe:context'),
  agents: () => ipcRenderer.invoke('cafe:agents'),
  mcpServers: () => ipcRenderer.invoke('cafe:mcp'),
  status: () => ipcRenderer.invoke('cafe:status'),
  persona: () => ipcRenderer.invoke('cafe:persona'),
  askLanguage: () => ipcRenderer.invoke('cafe:ask-language'),
  conversations: () => ipcRenderer.invoke('cafe:conversations'),
  folders: () => ipcRenderer.invoke('cafe:folders'),
  switchFolder: (cwd) => ipcRenderer.send('cafe:switch-folder', cwd),
  resume: (sessionId) => ipcRenderer.send('cafe:resume', sessionId),
  openFolder: () => ipcRenderer.invoke('cafe:open-folder'),
  notify: (body, waiting) => ipcRenderer.send('cafe:notify', body, waiting),
  clickThrough: (through) => ipcRenderer.send('cafe:click-through', through),
  followPointer: (at) => {
    const forward = (_event: unknown, x: number, y: number) => at(x, y)
    ipcRenderer.on('cafe:pointer-at', forward)
    return () => ipcRenderer.off('cafe:pointer-at', forward)
  },
  pathFor: (file) => webUtils.getPathForFile(file),
  startDrag: () => ipcRenderer.send('cafe:drag-start'),
  endDrag: () => ipcRenderer.send('cafe:drag-end'),
  listen: (onEvent) => {
    const forward = (_event: unknown, payload: BridgeEvent) => onEvent(payload)
    ipcRenderer.on('cafe:event', forward)
    return () => ipcRenderer.off('cafe:event', forward)
  },
}

contextBridge.exposeInMainWorld('cafe', bridge)
