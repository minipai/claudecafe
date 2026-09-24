import type { SceneAction, SceneShare, SideWindow } from './bridge'

/**
 * The log and the settings stand in windows of their own, beside her rather
 * than over her. What they show is the scene's — its messages, its language,
 * the room behind her — so the scene shares it, and anything clicked in them is
 * sent back for the scene to do, exactly as it would have done it itself.
 *
 * In the app the main process carries both ways. In the browser there is no
 * main process, so the side windows are tabs and a broadcast channel carries
 * the same messages between them.
 */
export const openSideWindow = window.cafe ? liveOpen : browserOpen
/** Scene → side windows: everything they draw, as it stands now. */
export const shareScene = window.cafe ? liveShare : browserShare
/** Side window: what the scene last shared, and every change after it. */
export const watchScene = window.cafe ? liveWatch : browserWatch
/** Side window → scene. */
export const sendToScene = window.cafe ? liveSend : browserSend
/** Scene: what the side windows asked for. */
export const listenToSideWindows = window.cafe ? liveListen : browserListen

/** Which side window this page is, if it is one at all. */
export function sideWindowOf(search: string): SideWindow | null {
  const name = new URLSearchParams(search).get('window')
  return SIDE_WINDOWS.find((each) => each === name) ?? null
}

const SIDE_WINDOWS: SideWindow[] = ['log', 'settings', 'projects', 'session']

function liveOpen(name: SideWindow) {
  window.cafe!.openSideWindow(name)
}

function liveShare(scene: SceneShare) {
  window.cafe!.shareScene(scene)
}

function liveWatch(onScene: (scene: SceneShare) => void) {
  return window.cafe!.watchScene(onScene)
}

function liveSend(action: SceneAction) {
  window.cafe!.sendToScene(action)
}

function liveListen(onAction: (action: SceneAction) => void) {
  return window.cafe!.listen((event) => {
    if (event.kind === 'side-window') onAction(event.action)
  })
}

type Broadcast =
  | { kind: 'scene'; scene: SceneShare }
  | { kind: 'ready' }
  | { kind: 'action'; action: SceneAction }

const CHANNEL = 'cafe-side-windows'
/** The scene's own copy, so a tab opened late is answered with it. */
let shared: SceneShare | null = null
let answeringReady = false

function browserOpen(name: SideWindow) {
  const url = new URL(window.location.href)
  url.search = new URLSearchParams({ window: name }).toString()
  window.open(url, `cafe-${name}`, 'popup,width=820,height=760')
}

function browserShare(scene: SceneShare) {
  shared = scene
  post({ kind: 'scene', scene })
  // A tab opened after the last change asks for it; the scene answers from
  // here, once, however many times it shares.
  if (answeringReady) return
  answeringReady = true
  new BroadcastChannel(CHANNEL).onmessage = ({ data }: MessageEvent<Broadcast>) => {
    if (data.kind === 'ready' && shared) post({ kind: 'scene', scene: shared })
  }
}

function browserWatch(onScene: (scene: SceneShare) => void) {
  const channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = ({ data }: MessageEvent<Broadcast>) => {
    if (data.kind === 'scene') onScene(data.scene)
  }
  channel.postMessage({ kind: 'ready' } satisfies Broadcast)
  return () => channel.close()
}

function browserSend(action: SceneAction) {
  post({ kind: 'action', action })
}

function browserListen(onAction: (action: SceneAction) => void) {
  const channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = ({ data }: MessageEvent<Broadcast>) => {
    if (data.kind === 'action') onAction(data.action)
  }
  return () => channel.close()
}

function post(message: Broadcast) {
  const channel = new BroadcastChannel(CHANNEL)
  channel.postMessage(message)
  channel.close()
}
