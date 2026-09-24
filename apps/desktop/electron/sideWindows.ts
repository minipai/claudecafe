import type { BrowserWindow, WebContents } from 'electron'
import type { SceneAction, SceneShare, SideWindow } from '../src/agent/bridge'

/**
 * The log and the settings of one scene. They draw what the scene last shared
 * and send back what is clicked in them; neither holds anything of its own, so
 * closing one loses nothing and opening it again picks up where the scene is.
 */
export class SideWindows {
  private readonly open = new Map<SideWindow, BrowserWindow>()
  private scene: SceneShare | null = null

  constructor(
    private readonly owner: BrowserWindow,
    private readonly create: (name: SideWindow) => BrowserWindow,
  ) {
    // They belong to her: when she goes, they go.
    owner.once('closed', () => {
      for (const side of this.open.values()) if (!side.isDestroyed()) side.close()
    })
  }

  show(name: SideWindow) {
    const standing = this.open.get(name)
    if (standing && !standing.isDestroyed()) {
      if (standing.isMinimized()) standing.restore()
      standing.focus()
      return
    }
    const side = this.create(name)
    this.open.set(name, side)
    side.once('closed', () => {
      if (this.open.get(name) === side) this.open.delete(name)
    })
  }

  owns(contents: WebContents) {
    return [...this.open.values()].some((side) => !side.isDestroyed() && side.webContents === contents)
  }

  share(scene: SceneShare) {
    this.scene = scene
    for (const side of this.open.values()) {
      if (!side.isDestroyed()) side.webContents.send('cafe:scene', scene)
    }
  }

  /** A side window that has just loaded is handed the scene as it stands. */
  ready(contents: WebContents) {
    if (this.scene) contents.send('cafe:scene', this.scene)
  }

  toScene(action: SceneAction) {
    if (!this.owner.isDestroyed()) this.owner.webContents.send('cafe:event', { kind: 'side-window', action })
  }
}
