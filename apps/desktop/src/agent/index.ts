import { query as mockQuery } from './mock'
import { query as liveQuery, newSession as endLiveSession } from './live'

/** In the browser there is no bridge, so the canned mock keeps standing in. */
export const isLive = typeof window !== 'undefined' && Boolean(window.cafe)

export const query = isLive ? liveQuery : mockQuery

/** The folder this window is bound to — null while running on the mock. */
export const workingDirectory = isLive ? (window.cafe?.cwd ?? null) : null

export function newSession() {
  if (isLive) endLiveSession()
}

export { INITIAL_LOOK } from './content'
export type { AgentMessage, Look, PermissionResult, QueryOptions, Question, Report, Tier, Todo } from './types'
export type { BacklogLine, CafeBridge, ModelChoice, SessionSettings, SessionStatus } from './bridge'
