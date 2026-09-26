import os from 'node:os'
import path from 'node:path'

/** The Cafe data root shared by every host and the desktop window. */
export function cafeRoot() {
  const configured = process.env.XDG_CONFIG_HOME?.trim()
  return path.join(configured || path.join(os.homedir(), '.config'), 'claudecafe')
}
