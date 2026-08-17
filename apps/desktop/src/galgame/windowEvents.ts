import type { Dispatch, RefObject, SetStateAction } from 'react'
import { faceFor } from '@/agent/expressions'
import { speakThis } from '@/i18n'
import type { BacklogLine, BridgeEvent, CafeCommand, Lines, Look, ModelChoice, Report, SessionSettings, Trouble } from '@/agent'
import { createChatMessage } from './chatlog'
import { speakThese } from './content'
import type { ChatMessage, Expression, Phase } from './types'

/**
 * What belongs to the window rather than to a run: the look (shot in the
 * background, minutes after the turn that prompted it), the settings, and the
 * backlog — which comes from the transcript, so a reload gets it back.
 */
export type WindowScene = {
  setLook: (look: Look) => void
  setLookUnread: (unread: boolean) => void
  setSettings: (settings: SessionSettings) => void
  setModels: (models: ModelChoice[]) => void
  setFolder: (cwd: string) => void
  setCommands: (commands: CafeCommand[]) => void
  setSpeech: (speech: { language: string; chosen: string }) => void
  setLocale: (choice: string) => void
  setLines: (lines: Lines) => void
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>
  setTrouble: (trouble: Trouble | null) => void
  setPhase: (phase: Phase) => void
  setConversation: (sessionId: string | null) => void
  setExpression: (expr: Expression) => void
  /** The write-up behind the link under the box, and whether the link is up. */
  setReport: (report: Report | null) => void
  setCtaVisible: (visible: boolean) => void
  /** What is cleared whenever the scene starts over somewhere it was not — a
   * report and the mood it was signed with, and any standing "always allow",
   * which belonged to what she was doing before and does not follow her here. */
  resetScene: () => void
  /** Straight into the box — a question, an interruption, a new session. */
  cut: (text: string) => void
  /** The opening as it currently stands, so a later rewrite knows what to replace. */
  greetingRef: RefObject<string>
  /** The same wording, read by the effect that only runs once — its closure
   * over `lines` itself is fixed at mount, so it reads this instead. */
  linesRef: RefObject<Lines>
  lastLineRef: RefObject<string>
}

/** A bridge event that is not scoped to a run — routed to whatever the window
 * keeps of its own, rather than to the choreography of the turn in flight. */
export function applyWindowEvent(event: BridgeEvent, scene: WindowScene) {
  if (event.kind === 'look') {
    scene.setLook(event.look)
    scene.setLookUnread(true)
  } else if (event.kind === 'settings') {
    scene.setSettings(event.settings)
    scene.setModels(event.models)
  } else if (event.kind === 'folder') {
    scene.setFolder(event.cwd)
  } else if (event.kind === 'commands') {
    scene.setCommands(event.commands)
  } else if (event.kind === 'speech') {
    scene.setSpeech({ language: event.language, chosen: event.chosen })
  } else if (event.kind === 'locale') {
    speakThis(event.locale)
    scene.setLocale(event.choice)
  } else if (event.kind === 'lines') {
    // Written after the window opened, so the opening may already be on
    // screen in English: it is swapped out as long as it is still all she
    // has said. Anything further down the log stays as it was said.
    speakThese(event.lines)
    const stale = scene.greetingRef.current
    scene.greetingRef.current = event.lines.greeting
    scene.linesRef.current = event.lines
    scene.setLines(event.lines)
    scene.setChatMessages((current) =>
      current.length === 1 && current[0].role === 'assistant' && current[0].content === stale
        ? [createChatMessage('assistant', event.lines.greeting)]
        : current,
    )
    if (scene.lastLineRef.current === stale) scene.cut(event.lines.greeting)
  } else if (event.kind === 'trouble') {
    // She cannot work and it is not hers to fix: the panel says whose it is.
    // Nothing is left spinning behind it — the turn is over either way.
    // Null is the door opening again, and takes the panel with it.
    scene.setTrouble(event.trouble)
    if (event.trouble) scene.setPhase('idle')
  } else if (event.kind === 'backlog') {
    scene.setConversation(event.sessionId)
    // A different conversation, or the same one from a different window —
    // either way, the report she handed over, the mood she signed it with,
    // and any standing "always allow" belonged to whatever she was doing
    // before, not to what is coming back.
    scene.resetScene()
    // The link under the box opened the last thing she handed over here; what
    // comes back brings its own, or none.
    scene.setReport(null)
    scene.setCtaVisible(false)
    // Nothing has been said where she has just arrived: she opens up the way
    // she does at the start of any session, rather than standing there with
    // the last folder's line still in the box.
    if (!event.lines.length) {
      scene.setChatMessages([createChatMessage('assistant', scene.linesRef.current.greeting)])
      scene.setExpression('neutral')
      scene.cut(scene.linesRef.current.greeting)
      return
    }
    scene.setChatMessages(
      event.lines.map((entry: BacklogLine) =>
        createChatMessage(entry.role, entry.content, entry.report, entry.at),
      ),
    )
    // Her last line comes back to the box the way the scene wants it —
    // marker off, and worn on her face instead.
    const last = [...event.lines].reverse().find((entry) => entry.role === 'assistant')
    if (last) {
      const marker = last.content.match(/【[^【】]*】\s*$/)
      const face = marker && faceFor(marker[0])
      if (face) scene.setExpression(face)
      scene.cut(marker ? last.content.slice(0, marker.index).trim() : last.content)
      // She handed the write-up over as her last act here, so the link that
      // opens it is still what belongs under the line.
      if (last.report) {
        scene.setReport(last.report)
        scene.setCtaVisible(true)
      }
    }
  }
}
