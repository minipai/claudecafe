import { query as mockQuery } from './demo/mock'
import { query as liveQuery, newSession as endLiveSession } from './transport/live'
import type { Conversation } from './bridge'
import { MOCK_CAST, MOCK_PERSONA, MOCK_SESSION, MOCK_SESSION_CWD, mockUsage } from './demo/content.mock'

/** In the browser there is no bridge, so the canned mock keeps standing in. */
export const isLive = typeof window !== 'undefined' && Boolean(window.cafe)

export const query = isLive ? liveQuery : mockQuery

/** The folder this window is bound to. The mock is bound to one too: an empty
 * status line reads as a window that has lost its session. */
export const workingDirectory = isLive ? (window.cafe?.cwd ?? null) : MOCK_SESSION_CWD

export function newSession() {
  if (isLive) endLiveSession()
}

/**
 * What the panels are told. Every one of them is measured off a real session,
 * which in the browser there is none of — so the canned café answers instead,
 * the same way it answers for the model.
 */
export const usageReport = isLive ? () => window.cafe!.usage() : async () => mockUsage()
export const maidPersona = isLive ? () => window.cafe!.persona() : async () => MOCK_PERSONA
export const castList = isLive ? () => window.cafe!.cast() : async () => MOCK_CAST
export const recentFolders = isLive ? () => window.cafe!.folders() : async () => [MOCK_SESSION_CWD]
export const folderConversations = isLive
  ? (folder: string) => window.cafe!.folderConversations(folder)
  : async (): Promise<Conversation[]> => []

/** What the bottom plate shows before any turn has been taken — live, this
 * arrives as an event instead. */
export const openingStatus = isLive ? null : MOCK_SESSION

export type { AgentMessage, Attachment, PermissionResult, QueryOptions, Question, Tier, Todo } from './types'
export type {
  Backdrop,
  BacklogLine,
  BridgeEvent,
  CafeBridge,
  CafeCommand,
  CastMember,
  Conversation,
  Lines,
  SceneAction,
  SceneShare,
  SideWindow,
  ModelChoice,
  SessionSettings,
  SessionStatus,
  Shift,
  Trouble,
  UsageReport,
  UsageWindow,
} from './bridge'
