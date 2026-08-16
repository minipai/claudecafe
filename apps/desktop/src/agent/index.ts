import { query as mockQuery } from './mock'
import { query as liveQuery, newSession as endLiveSession } from './live'
import { MOCK_AGENTS, MOCK_CONTEXT, MOCK_MCP, MOCK_SESSION, MOCK_SESSION_CWD, MOCK_STATUS, mockUsage } from './content.mock'

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
export const contextReport = isLive ? () => window.cafe!.context() : async () => MOCK_CONTEXT
export const subagents = isLive ? () => window.cafe!.agents() : async () => MOCK_AGENTS
export const mcpServers = isLive ? () => window.cafe!.mcpServers() : async () => MOCK_MCP
export const sessionStatus = isLive ? () => window.cafe!.status() : async () => MOCK_STATUS

/** What the bottom plate shows before any turn has been taken — live, this
 * arrives as an event instead. */
export const openingStatus = isLive ? null : MOCK_SESSION

export { INITIAL_LOOK } from './content.mock'
export type { AgentMessage, Attachment, Look, PermissionResult, QueryOptions, Question, Report, Tier, Todo } from './types'
export type {
  BacklogLine,
  CafeBridge,
  CafeCommand,
  ContextReport,
  Conversation,
  Lines,
  McpServer,
  ModelChoice,
  SessionSettings,
  SessionStatus,
  StatusReport,
  Subagent,
  Trouble,
  UsageReport,
  UsageWindow,
} from './bridge'
