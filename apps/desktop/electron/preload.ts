import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { BridgeEvent, CafeBridge } from '../src/agent/bridge'

const folderArg = process.argv.find((arg) => arg.startsWith('--cafe-cwd=')) ?? ''

const bridge: CafeBridge = {
  cwd: folderArg.slice('--cafe-cwd='.length),
  start: (runId, prompt, images) => ipcRenderer.send('cafe:start', runId, prompt, images),
  answer: (askId, value) => ipcRenderer.send('cafe:answer', askId, value),
  interrupt: () => ipcRenderer.send('cafe:interrupt'),
  newSession: () => ipcRenderer.send('cafe:new-session'),
  refresh: () => ipcRenderer.send('cafe:refresh'),
  configure: (patch) => ipcRenderer.send('cafe:configure', patch),
  usage: () => ipcRenderer.invoke('cafe:usage'),
  context: () => ipcRenderer.invoke('cafe:context'),
  agents: () => ipcRenderer.invoke('cafe:agents'),
  mcpServers: () => ipcRenderer.invoke('cafe:mcp'),
  status: () => ipcRenderer.invoke('cafe:status'),
  conversations: () => ipcRenderer.invoke('cafe:conversations'),
  folders: () => ipcRenderer.invoke('cafe:folders'),
  switchFolder: (cwd) => ipcRenderer.send('cafe:switch-folder', cwd),
  resume: (sessionId) => ipcRenderer.send('cafe:resume', sessionId),
  openFolder: () => ipcRenderer.invoke('cafe:open-folder'),
  notify: (body, waiting) => ipcRenderer.send('cafe:notify', body, waiting),
  clickThrough: (through) => ipcRenderer.send('cafe:click-through', through),
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
