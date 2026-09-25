import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { Stage } from './Stage'
import { SpriteLayer } from './SpriteLayer'
import { hasArtwork, availableShift } from './cast'
import { ShiftPanel } from './ShiftPanel'
import { KAOMOJI } from '@/agent/expressions'
import { DialogueBox } from './DialogueBox'
import { PlanView } from './PlanView'
import { WelcomePanel } from './WelcomePanel'
import { PersonaPanel } from './PersonaPanel'
import { CommandBar } from './CommandBar'
import { TroublePanel } from './TroublePanel'
import { DemoRow } from './DemoRow'
import { InputBar } from './InputBar'
import { PermissionPrompt } from './PermissionPrompt'
import { ChoiceRow } from './ChoiceRow'
import { WhisperZone } from './WhisperZone'
import { StatusBar } from './StatusBar'
import { SessionPlaque } from './SessionPlaque'
import { useSpeech, type Hooks } from './useSpeech'
import { alwaysCovers, readPermission, standingFor, type PermissionAsk } from './permission'
import { toast } from 'sonner'
import { createChatMessage, createPreviewHistory, recordToolResult } from './chatlog'
import { choreograph, type Scene } from './choreography'
import { applyWindowEvent, type WindowScene } from './windowEvents'
import type { Backdrop as Chosen, CastMember, Shift } from '@/agent'
import type { ChatMessage, Expression, Phase, Whisper } from './types'
import { lines as currentLines } from './content'
import { fill, her, nowServing, text } from '@/i18n'
import { listenToSideWindows, openSideWindow, shareScene } from '@/agent/windows'
import {
  INITIAL_LOOK,
  isLive,
  newSession,
  query,
  workingDirectory,
  type Attachment,
  type AgentMessage,
  type CafeCommand,
  type Look,
  type PermissionResult,
  type SceneAction,
  type SessionTab,
  type SideWindow,
  type ModelChoice,
  type Question,
  type SessionSettings,
  type Lines,
  type Todo,
  type Trouble,
} from '@/agent'

/** The slash commands whose figures the session window draws, instead of
 * letting the CLI print a flattened copy of them — each one its own tab. */
const SESSION_COMMANDS: Record<string, SessionTab> = {
  '/usage': 'usage',
  '/context': 'context',
  '/agents': 'agents',
  '/mcp': 'mcp',
  '/status': 'status',
}

/** The window's own commands, which the CLI does not have: `/keys` is written
 * down in the settings, since a terminal has no keys of its own to explain, and
 * `/cd` and `/resume` are the projects window. */
const WINDOW_COMMANDS: Record<string, SideWindow> = {
  '/keys': 'settings',
  '/cd': 'projects',
  '/resume': 'projects',
}

type PermissionRequest = {
  ask: PermissionAsk
  resolve: (result: PermissionResult) => void
}

type ChoiceRequest = {
  /** Stamped fresh per question, so two questions sharing a header do not
   * reuse the same ChoiceRow instance — and with it, the last one's ticks. */
  id: number
  question: Question
  resolve: (picks: string[]) => void
}

let whisperId = 0
let choiceRequestId = 0

export function GalgameClient({
  cast,
  directory,
  onRefreshCharacters,
}: {
  cast: CastMember[]
  directory: string
  onRefreshCharacters: () => Promise<void>
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [expression, setExpression] = useState<Expression>('neutral')
  /** The 【…】 she signed her last line with, kept as she wrote it. Empty until
   * she has signed one — the window has nothing of its own to put there. */
  const [mood, setMood] = useState<string | null>(null)
  /** The kaomoji standing in for a face she has no artwork for. */
  const [standIn, setStandIn] = useState<string | null>(null)
  const [laidOut, setLaidOut] = useState<string | null>(null)
  const [whispers, setWhispers] = useState<Whisper[]>([])
  // A real look is shot by the plugin once there is work to shoot; until then
  // there is nothing to peek at. The mock opens with a canned one.
  const [look, setLook] = useState<Look | null>(isLive ? null : INITIAL_LOOK)
  const [lookUnread, setLookUnread] = useState(true)
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)
  const [permissionExpanded, setPermissionExpanded] = useState(false)
  const [choiceRequest, setChoiceRequest] = useState<ChoiceRequest | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  // Her board stays up while anything on it is still to do, across turns the
  // same as the CLI's, and goes once the last of it is ticked off.
  const board = todos.some((todo) => todo.status !== 'completed') ? todos : []
  /** How much she has written since the prompt went in — what the waiting line
   * counts up while he waits. Reset when a fresh prompt starts it over. */
  const [outputTokens, setOutputTokens] = useState(0)
  const [changingSession, setChangingSession] = useState(false)
  const [compacting, setCompacting] = useState(false)
  const [settings, setSettings] = useState<SessionSettings>({ model: null, effort: 'high', mode: 'default', modePicked: false })
  const [models, setModels] = useState<ModelChoice[]>([])
  const [commands, setCommands] = useState<CafeCommand[]>([])
  /** The slash command the window is answering itself, if any. */
  const [personaOpen, setPersonaOpen] = useState(false)
  /** Which tab the session window was last asked for. */
  const [sessionAsk, setSessionAsk] = useState<{ tab: SessionTab; asked: number }>({ tab: 'usage', asked: 0 })
  /** Why she cannot work at all, when the session says so. */
  const [trouble, setTrouble] = useState<Trouble | null>(null)
  /** The conversation she is on, as the session last reported it. */
  const [conversation, setConversation] = useState<string | null>(null)
  /** The folder she is on. It changes under the window when she is sent
   * elsewhere, so it is state rather than something read once at startup. */
  const [folder, setFolder] = useState(workingDirectory ?? '')
  const [switching, setSwitching] = useState(false)
  /** The interface's language, which is not hers: what was picked (maybe
   * `system`) and the code it is drawn in, kept so switching it redraws
   * everything under this component — and the side windows with it. */
  const [locale, setLocale] = useState(() => ({
    choice: window.cafe?.localeChoice ?? 'system',
    drawn: window.cafe?.locale ?? navigator.language,
  }))
  /** What she is speaking, as the session reports it — a sentence, not a code. */
  const [speech, setSpeech] = useState({ language: '', chosen: '' })
  /** Which room is behind her and how its picture is cut off. Read off the
   * bridge rather than defaulted here, so the first frame is already right. */
  const [backdrop, setBackdrop] = useState<Chosen>(
    () => window.cafe?.backdrop ?? 'art-nouveau',
  )
  /** Who is standing there. Off the bridge for the same
   * reason as the room behind her: the first frame has to have the right maid
   * in it. */
  const [shift, setShift] = useState<Shift>(() => availableShift(cast, window.cafe?.shift ?? { maid: cast[0].id }))
  const maid = cast.find((maid) => maid.id === shift.maid) ?? cast[0]
  nowServing(maid.name)
  const castRef = useRef(cast)
  castRef.current = cast
  /** Whether the master is choosing a maid for a new conversation. */
  const [pickingShift, setPickingShift] = useState(false)
  /** Nobody on this machine has ever said what she should speak or what the
   * window should be drawn in, so both are asked once before anything else. */
  const [welcoming, setWelcoming] = useState(false)
  // A real session starts empty; the canned backlog is only there to give the
  // mock something to show.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    isLive
      ? [createChatMessage('assistant', currentLines().greeting)]
      : createPreviewHistory(currentLines().greeting),
  )
  /** Her wording, once the session has written it — English until then. */
  const [lines, setLines] = useState<Lines>(currentLines)
  /** The opening as it currently stands, so a later rewrite knows what to replace. */
  const greetingRef = useRef(currentLines().greeting)
  /** The same wording, read by the effect that only runs once — its closure
   * over `lines` itself is fixed at mount, so it reads this instead. */
  const linesRef = useRef<Lines>(currentLines())
  const lastLineRef = useRef(currentLines().greeting)
  /** Every run still in flight. A prompt sent while she is working starts its
   * own, so stopping her has to reach all of them — with only the newest kept,
   * the older run carried on and put the plate back to spinning the moment the
   * stopped one landed. */
  const inFlight = useRef(new Set<AbortController>())
  /** What she has been told she may keep doing without asking again. Kept by
   * what was actually allowed — one yes to a command is not a yes to all of
   * them, and never to her editing files. */
  const alwaysAllowRef = useRef(new Set<string>())
  const permissionRef = useRef<PermissionRequest | null>(null)
  const running = useRef(0)
  /** Background completions have no renderer run of their own. If one arrives
   * while the master has another turn in flight, keep its scene beats here so
   * it cannot interrupt or overwrite the foreground conversation. */
  const ambientMessages = useRef<AgentMessage[]>([])
  /** The bridge listener lives for the mount, but the scene it calls changes
   * with the maid. Always point it at the newest closure. */
  const playAmbientRef = useRef<(message: AgentMessage) => void>(() => {})

  const {
    line,
    isDone,
    past,
    say: queueLine,
    act,
    cut: cutIn,
    clear: clearSpeech,
    advance,
    queued,
    pace,
    setPace,
  } = useSpeech()

  /** Behind whatever she is already saying. One block of hers is one line —
   * she already writes them as separate things. */
  function say(text: string, hooks?: Hooks) {
    lastLineRef.current = text
    // The layout belongs to the line it was drawn for, so it goes when that
    // line leaves the box and not a moment earlier — dropped while the line
    // was still standing, a written-out answer reflowed into one wall of text
    // in front of the master the instant he asked the next thing.
    queueLine(text, {
      ...hooks,
      onShow: () => {
        setLaidOut(null)
        hooks?.onShow?.()
      },
    })
  }

  /** Straight into the box — a question, an interruption, a new session. */
  function cut(text: string) {
    lastLineRef.current = text
    setLaidOut(null)
    cutIn(text)
  }

  const appendChatMessage = useCallback((role: ChatMessage['role'], content: string) => {
    setChatMessages((current) => [...current, createChatMessage(role, content)])
  }, [])

  /** Things that happened between the spoken lines — tools, permissions,
   * interruptions. `output` is what it answered, when that is known already;
   * a tool call gets its answer later, by id. */
  const appendEvent = useCallback((content: string, detail?: string, toolId?: string, output?: string) => {
    setChatMessages((current) => [
      ...current,
      { ...createChatMessage('event', content, Date.now(), detail), toolId, output },
    ])
  }, [])

  /** What a tool answered, put on the row that recorded the call. */
  const recordResult = useCallback((toolId: string, output: string, failed: boolean) => {
    setChatMessages((current) => recordToolResult(current, toolId, output, failed))
  }, [])

  function pushWhisper(text: string, kind: Whisper['kind']) {
    const id = whisperId++
    setWhispers((prev) => [...prev, { id, text, kind }])
    setTimeout(() => {
      setWhispers((prev) => prev.filter((w) => w.id !== id))
    }, kind === 'tool' ? 2400 : 3200)
  }

  /** The face that came with a line goes on as the line does, not when it was
   * written — she may have said three things since. */
  /** The face she signed a line with, put on when that line reaches the box —
   * the marker as she wrote it, and the artwork it names. A line with no
   * marker of its own is not left wearing the last one that had one — the
   * corner clears with it, even though the face can stay. */
  function wear(expr?: Expression, marker?: string) {
    setMood(marker ?? null)
    // A line with no marker of its own changes no face, and leaves whatever is
    // standing in for the current one where it is.
    if (expr) showFace(expr)
  }

  /** Put a face on. She has only been drawn wearing some of them: the rest
   * leave her standing neutral, and the kaomoji stands in beside her name so
   * the change is still visible — whether a tool asked for the face mid-turn
   * or she signed a line with it. */
  function showFace(expr: Expression) {
    setExpression(expr)
    setStandIn(hasArtwork(maid, expr) ? null : KAOMOJI[expr])
  }

  /** The same scene both prompted and unsolicited turns play through. Kept in
   * one place so a background completion is rendered with exactly the same
   * log, speech and expression semantics as an ordinary answer. */
  function currentScene(): Scene {
    return {
      appendChatMessage,
      appendEvent,
      recordResult,
      say,
      act,
      wear,
      showFace,
      pushWhisper,
      setPhase,
      setTodos,
      setOutputTokens,
      setLook,
      setLookUnread,
      setLaidOut,
      notify: (body) => window.cafe?.notify(body, false),
    }
  }

  function playAmbient(message: AgentMessage) {
    if (running.current > 0) {
      ambientMessages.current.push(message)
      return
    }
    choreograph(message, currentScene())
  }

  function flushAmbient() {
    const waiting = ambientMessages.current.splice(0)
    const scene = currentScene()
    for (const message of waiting) choreograph(message, scene)
  }
  playAmbientRef.current = playAmbient

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    cut(lines.greeting)
  }, [])

  useEffect(() => {
    void window.cafe?.askLanguage().then(setWelcoming)
  }, [])

  /**
   * What belongs to the window rather than to a run: the look (shot in the
   * background, minutes after the turn that prompted it), the settings, and the
   * backlog — which comes from the transcript, so a reload gets it back.
   */
  useEffect(() => {
    const windowScene: WindowScene = {
      setLook,
      setLookUnread,
      setSettings,
      setModels,
      setFolder,
      setCommands,
      setSpeech,
      setLocale,
      setBackdrop,
      // A removed maid is replaced by the first available character.
      setShift: (next: Shift) => setShift(availableShift(castRef.current, next)),
      setLines,
      setChatMessages,
      setTrouble,
      setPhase,
      setConversation,
      setExpression,
      setLaidOut,
      resetScene,
      cut,
      greetingRef,
      linesRef,
      lastLineRef,
    }
    const stop = window.cafe?.listen((event) => {
      if (event.kind === 'ambient-message') playAmbientRef.current(event.message)
      else applyWindowEvent(event, windowScene)
    })
    window.cafe?.refresh(cast.map((maid) => maid.id))
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** The log and the settings stand in windows of their own; they draw what
   * the scene shares with them, as it changes. */
  useEffect(() => {
    shareScene({
      locale: locale.drawn,
      maidName: maid.name,
      folder,
      conversation,
      log: {
        messages: chatMessages,
        isBusy: phase === 'working',
        isCompacting: compacting,
        isAwaitingAnswer: permissionRequest !== null || choiceRequest !== null,
      },
      todos: board,
      settings: { locale: locale.choice, speech, backdrop },
      session: sessionAsk,
    })
  }, [locale, maid.name, folder, conversation, chatMessages, phase, compacting, permissionRequest, choiceRequest, board, speech, backdrop, sessionAsk])

  /** What was clicked in them is done here, the way the scene would have done it. */
  const sideActionRef = useRef<(action: SceneAction) => void>(() => {})
  sideActionRef.current = (action) => {
    if (action.kind === 'compact') void compactSession()
    else if (action.kind === 'new-session') startNewSession()
    else if (action.kind === 'return') window.focus()
    else if (action.kind === 'locale') window.cafe?.setLocale(action.choice)
    else if (action.kind === 'speech') window.cafe?.setSpeech(action.language)
    else if (action.kind === 'backdrop') {
      // Shown at once and kept by the main process; the event it sends back
      // lands on a window already drawing it.
      setBackdrop(action.backdrop)
      window.cafe?.setBackdrop(action.backdrop)
    } else if (action.kind === 'folder') {
      window.cafe?.switchFolder(action.folder)
      leaveScene()
    } else if (action.kind === 'browse') {
      void window.cafe?.openFolder().then((picked) => picked && leaveScene())
    } else if (action.kind === 'conversation') {
      if (action.folder !== folder) window.cafe?.switchFolder(action.folder)
      window.cafe?.resume(action.sessionId)
      leaveScene()
    }
  }
  useEffect(() => listenToSideWindows((action) => sideActionRef.current(action)), [])

  /** ⌘⇧P is the command palette, the key editors already use for it. ⌘L is
   * the log, which is otherwise a button on the plate and a row inside the
   * palette — the one window opened often enough to be worth a key of its own.
   * ⌘, is the settings, where every Mac app keeps them. */
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      // A folded-out plan is drawn over everything, so a panel opened under it is one
      // the master can neither see nor close — and it would take the next esc
      // meant for the plan.
      if (permissionExpanded || trouble) return
      // Shift turns the key into a capital, and not on every layout the same way.
      if (event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        setSwitching(true)
      } else if (event.key === 'l') {
        event.preventDefault()
        openSideWindow('log')
      } else if (event.key === ',') {
        event.preventDefault()
        openSideWindow('settings')
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [permissionExpanded, trouble])

  /**
   * Esc cuts her off, the way it does in the terminal she came from — the stop
   * button is otherwise the only way, and it means aiming at a small square
   * while she is still writing. Only when the scene is hers: a panel takes Esc
   * to close itself first, and a question she is waiting on is answered in the
   * footer rather than by stopping everything she was doing to ask it.
   */
  useEffect(() => {
    const interrupt = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // Mid-composition Esc is the IME dropping what was being spelled out.
      if (event.isComposing) return
      if (phase !== 'working') return
      if (permissionExpanded || switching || personaOpen || trouble) return
      if (permissionRequest || choiceRequest) return
      event.preventDefault()
      stop()
    }
    window.addEventListener('keydown', interrupt)
    return () => window.removeEventListener('keydown', interrupt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, permissionExpanded, switching, personaOpen, trouble, permissionRequest, choiceRequest])

  /**
   * Space turns the page, the way a galgame does — and it is taken in the
   * capture pass, before whatever has focus can have it. A line waiting to be
   * read is the scene asking to be clicked on, and until it has been, Space
   * belongs to the scene rather than to the composer: one key, one meaning,
   * wherever the hand happens to be. Once she has nothing left queued it is a
   * space again.
   */
  useEffect(() => {
    const turn = (event: KeyboardEvent) => {
      if (event.key !== ' ' || event.metaKey || event.ctrlKey || event.altKey) return
      // Mid-composition Space is the IME picking a word, never a page turn.
      if (event.isComposing) return
      if (queued === 0 || !isDone) return
      // Except while something else holds the scene — a folded-out permission,
      // a panel — where there is no box to turn.
      if (permissionExpanded || switching || personaOpen) return
      event.preventDefault()
      event.stopPropagation()
      advance()
    }
    window.addEventListener('keydown', turn, true)
    return () => window.removeEventListener('keydown', turn, true)
  }, [queued, isDone, advance, permissionExpanded, switching, personaOpen])


  function askPermission(request: PermissionRequest | null) {
    permissionRef.current = request
    setPermissionRequest(request)
    if (!request) setPermissionExpanded(false)
  }

  async function canUseTool(toolName: string, input: Record<string, unknown>) {
    const ask = readPermission(toolName, input)
    if (alwaysCovers(alwaysAllowRef.current, ask)) return { behavior: 'allow' as const }
    // The question waits its turn like anything else she says — what she said on
    // the way to asking it is often the reason the answer is yes. The buttons
    // only appear once the master has clicked through to the question itself.
    return new Promise<PermissionResult>((resolve) => {
      say(ask.askLine, {
        halt: true,
        onShow: () => {
          askPermission({ ask, resolve })
          // She has stopped on this and cannot go on without an answer, so it
          // follows the master wherever he is looking.
          window.cafe?.notify(ask.title, true)
        },
        // Moved past before it ever took the box — the ask is still hers to
        // answer, and no is the answer that leaves nothing waiting on him.
        onDrop: () => resolve({ behavior: 'deny' }),
      })
    })
  }

  function resolvePermission(behavior: 'allow' | 'deny', always = false) {
    const request = permissionRef.current
    if (!request) return
    if (always) {
      const standing = standingFor(request.ask)
      if (standing) alwaysAllowRef.current.add(standing)
    }
    const verdict =
      behavior === 'allow'
        ? always
          ? `Allowed for this session: ${request.ask.standing}`
          : 'Allowed'
        : 'Denied'
    appendEvent(always && behavior === 'allow' ? verdict : `${verdict}: ${request.ask.title}`, request.ask.command)
    askPermission(null)
    request.resolve({ behavior })
  }

  /** AskUserQuestion: she asks, the footer turns into the choice branch. */
  async function askUser(question: Question) {
    return new Promise<string[]>((resolve) => {
      say(question.question, {
        halt: true,
        onShow: () => {
          setChoiceRequest({ id: choiceRequestId++, question, resolve })
          window.cafe?.notify(question.question, true)
        },
        // Nothing picked reads the same as the master having moved past it —
        // which is exactly what happened.
        onDrop: () => resolve([]),
      })
    })
  }

  function answerChoice(picks: string[]) {
    setChoiceRequest((current) => {
      current?.resolve(picks)
      return null
    })
    appendEvent(`Answered: ${picks.length > 0 ? picks.join(', ') : 'nothing picked'}`)
  }

  /** Every run at once. The count is left to each run's own way out, so a
   * prompt sent in the moment between the abort and the last of them unwinding
   * is not counted as finished along with them. */
  function stopEverything() {
    for (const controller of inFlight.current) controller.abort()
  }

  /**
   * What is cleared whenever the scene starts over somewhere it was not — a
   * new session, a folder she was sent to, a conversation resumed. The mood
   * her last line was signed with belonged to whatever she was saying before;
   * a standing "always allow" belonged to what she was doing before,
   * which is exactly why it does not follow her anywhere else.
   */
  function resetScene() {
    setLaidOut(null)
    setMood(null)
    setStandIn(null)
    ambientMessages.current = []
    alwaysAllowRef.current = new Set()
  }

  function stop() {
    stopEverything()
    permissionRef.current?.resolve({ behavior: 'deny' })
    askPermission(null)
    setChoiceRequest((current) => {
      current?.resolve([])
      return null
    })
    // Whatever was still queued behind the line she was on — an ask included
    // — belongs to the question before this one; left in place, it would
    // resurface once the master clicks past what is on screen now, asking to
    // answer something that is already over.
    clearSpeech()
    appendEvent(text().scene.interrupted)
    setPhase('idle')
    say(lines.interrupted)
    appendChatMessage('assistant', lines.interrupted)
  }

  /** Start over with the maid already on shift. */
  function startNewSession() {
    if (changingSession) return
    startOver()
  }

  /** Refresh the cast before choosing who will serve the next conversation. */
  async function chooseNewMaid() {
    if (changingSession) return
    await onRefreshCharacters()
    setPickingShift(true)
  }

  /**
   * She has been picked, so the conversation starts over with her in it.
   *
   * The main process is told before the reset rather than after: it reads who
   * is on shift as the session opens, and a maid arriving a moment late would
   * mean one more conversation in the old one's voice.
   */
  function handOverShift(next: Shift, name: string) {
    setPickingShift(false)
    setShift(next)
    nowServing(name)
    window.cafe?.setShift(next)
    startOver()
  }

  /**
   * Everything the old session accumulated goes with it — backlog, tasks,
   * standing permissions — and she greets the master again, the way she
   * does at the start of any session.
   */
  function startOver() {
    stopEverything()
    permissionRef.current?.resolve({ behavior: 'deny' })
    askPermission(null)
    newSession()
    setChangingSession(true)

    window.setTimeout(() => {
      setPhase('idle')
      setTodos([])
      resetScene()
      // Read through the ref, not the closure: the session answers a handover
      // with the new maid's lines while this pause is still running, and the
      // closure is whoever stood here before her.
      const opening = linesRef.current.greeting
      setChatMessages([createChatMessage('assistant', opening)])
      setExpression('neutral')
      setLook(isLive ? null : INITIAL_LOOK)
      setLookUnread(true)
      setChoiceRequest(null)
      cut(opening)
      setChangingSession(false)
    }, 340)
  }

  /**
   * Compaction is requested the way the SDK takes it — /compact as a prompt —
   * and the only thing that comes back is a boundary marker, which the backlog
   * draws a line at. Nothing in the scene changes; the memory behind it does.
   */
  async function compactSession() {
    if (phase === 'working' || compacting) return
    setCompacting(true)
    // Wired into the same set stop() reaches for, so the same stop that cuts
    // off a run cuts off a compaction sitting in for one — without it, this
    // run answered to nothing, and every tool it might have asked about was
    // waved through by live.ts's own default for exactly that reason.
    const controller = new AbortController()
    inFlight.current.add(controller)
    try {
      for await (const msg of query({ prompt: '/compact', abortController: controller })) {
        if (msg.type === 'system' && msg.subtype === 'compact_boundary') {
          setChatMessages((current) => [...current, createChatMessage('boundary', text().log.compacted)])
          toast.success(text().scene.compacted, { description: text().scene.compactedNote })
        }
      }
    } catch (error) {
      toast.error(currentLines().errorTitle, {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      inFlight.current.delete(controller)
    }
    setCompacting(false)
  }

  // ---- consume the agent stream, drive the choreography off whatever it yields ----
  async function run(prompt: string, images: Attachment[] = []) {
    appendChatMessage('user', prompt)
    // The picture itself is hers to look at; the log records that it was handed
    // over, which is what the master will want to remember later.
    if (images.length) {
      appendEvent(
        images.length === 1
          ? text().scene.handedOverOne
          : fill(text().scene.handedOver, { count: images.length }),
      )
    }
    // The input clears itself on submit; his words float up the scene instead
    // of vanishing between the typing and her answer. A picture sent with
    // nothing said still floats something, or the scene looks like it missed it.
    pushWhisper(prompt || '📎', 'master')
    setPhase('working')
    // The master has moved the scene on himself: anything of hers still waiting
    // to be clicked through belongs to the question before this one.
    clearSpeech()
    setOutputTokens(0)

    const controller = new AbortController()
    inFlight.current.add(controller)
    running.current++

    try {
      await consume(controller, prompt, images)
    } catch (error) {
      // Anything the agent throws — a dropped connection, a refused request —
      // lands here. The scene stays put and the failure is reported as a toast.
      const message = error instanceof Error ? error.message : String(error)
      toast.error(currentLines().errorTitle, {
        description: message,
        action: { label: text().scene.retry, onClick: () => run(prompt) },
      })
      appendEvent(text().scene.runFailed, message)
      setPhase('idle')
      askPermission(null)
    } finally {
      // Another prompt may still be queued behind this one; the scene is only
      // done working once the last of them is — and once none are left she is
      // not working, whatever ended them. Without that last part a run that
      // finished any way other than by a result (stopped mid-tool, the session
      // dropped) left the plate spinning with nobody behind it.
      inFlight.current.delete(controller)
      running.current = Math.max(0, running.current - 1)
      if (running.current > 0) setPhase('working')
      else {
        setPhase((standing) => (standing === 'working' ? 'idle' : standing))
        flushAmbient()
      }
    }
  }

  async function consume(controller: AbortController, prompt: string, images: Attachment[]) {
    const scene = currentScene()
    for await (const msg of query({ prompt, images, abortController: controller, canUseTool, askUser })) {
      choreograph(msg, scene)
    }
  }

  /** The session window, on the tab asked for. */
  function showSession(tab: SessionTab) {
    setSessionAsk((current) => ({ tab, asked: current.asked + 1 }))
    openSideWindow('session')
  }

  /**
   * She was sent somewhere else. Whatever she was in the middle of belongs to
   * where the master just left; the scene starts over with what comes back.
   */
  function leaveScene() {
    clearSpeech()
    setPhase('idle')
    setTodos([])
    resetScene()
  }

  /**
   * A slash command the window answers better than the session does. What
   * these print in a terminal is a flattening of figures the session will hand
   * over whole, so a window asks for those instead of running a turn.
   */
  function handleSubmit(text: string, images: Attachment[] = []) {
    const said = text.trim()
    if (!said && !images.length) return
    if (said in SESSION_COMMANDS) return showSession(SESSION_COMMANDS[said])
    if (said in WINDOW_COMMANDS) return openSideWindow(WINDOW_COMMANDS[said])
    if (said === '/persona') return setPersonaOpen(true)
    run(said, images)
  }

  return (
    <>
      <Stage>
        <SpriteLayer expression={expression} maid={maid} name={her()} backdrop={backdrop} />

        {/* The band above the box is where the whispers float; there is nothing
            to click there, so the pointer goes through it too. */}
        <div data-ghost className="absolute bottom-10 left-1/2 z-[6] w-[min(760px,92vw)] -translate-x-1/2">
          <WhisperZone whispers={whispers} />
          {!permissionExpanded && (
            <DialogueBox
              line={line}
              laidOut={laidOut}
              isTyping={!isDone}
              isPast={past}
              isLoading={phase === 'working'}
              mood={mood}
              standIn={standIn}
              waiting={lines.waiting}
              outputTokens={outputTokens}
              queued={queued}
              onAdvance={advance}
              pace={pace}
              onPace={setPace}
              todos={board}
              onOpenReply={() => openSideWindow('reply')}
              onOpenPersona={() => setPersonaOpen(true)}
              utility={
                <SessionPlaque
                  onOpenHistory={() => openSideWindow('log')}
                  onSwitch={() => setSwitching(true)}
                  settings={settings}
                  models={models}
                  onChange={(patch) => {
                    setSettings((current) => ({ ...current, ...patch }))
                    window.cafe?.configure(patch)
                  }}
                />
              }
              unreadLook={lookUnread ? look : null}
              onLookRead={() => setLookUnread(false)}
              footer={
                <>
                  {choiceRequest ? (
                    <ChoiceRow
                      key={choiceRequest.id}
                      question={choiceRequest.question}
                      onAnswer={answerChoice}
                    />
                  ) : permissionRequest ? (
                    <PermissionPrompt
                      ask={permissionRequest.ask}
                      onAllow={() => resolvePermission('allow')}
                      onAlwaysAllow={() => resolvePermission('allow', true)}
                      onDeny={() => resolvePermission('deny')}
                      onExpand={() => setPermissionExpanded(true)}
                    />
                  ) : isLive ? null : (
                    // The demo buttons drive the canned mock; with a real agent
                    // on the other end there is nothing for them to stand in for.
                    <DemoRow onSelect={run} />
                  )}
                  <InputBar
                    isBusy={phase === 'working'}
                    commands={commands}
                    onSubmit={handleSubmit}
                    onStop={stop}
                  />
                </>
              }
            />
          )}
        </div>

        <StatusBar folder={folder} />
      </Stage>

      {/* Clicking off a folded-out plan closes it. Nothing is painted here: the
       * window is transparent, so a dimmed sheet would darken the desktop behind
       * her rather than the scene — the plan carries its own solid card. */}
      {permissionExpanded && (
        <div className="fixed inset-0 z-[149]" onClick={() => setPermissionExpanded(false)} />
      )}

      <TroublePanel trouble={trouble} onClose={() => setTrouble(null)} />
      <PersonaPanel open={personaOpen} onClose={() => setPersonaOpen(false)} />
      <WelcomePanel open={welcoming} onDone={() => setWelcoming(false)} />
      <ShiftPanel
        open={pickingShift}
        cast={cast}
        directory={directory}
        chosen={shift}
        onStart={handOverShift}
        onCancel={() => setPickingShift(false)}
      />
      <CommandBar
        open={switching}
        folder={folder}
        doing={{
          onNewSession: startNewSession,
          onChooseMaid: chooseNewMaid,
          onOpenHistory: () => openSideWindow('log'),
          onOpenSettings: () => openSideWindow('settings'),
          onCompact: compactSession,
          onOpenProjects: () => openSideWindow('projects'),
          onOpenSession: showSession,
          mode: settings.mode,
          modePicked: settings.modePicked,
          onMode: (mode) => {
            // Null hands it back to his terminal: the window stops having an
            // opinion, and what the session reports next is what it shows.
            const patch = mode === null ? { modePicked: false } : { mode }
            setSettings((current) => ({ ...current, ...patch }))
            window.cafe?.configure(patch)
          },
        }}
        onClose={() => setSwitching(false)}
      />

      <AnimatePresence>
        {permissionExpanded && permissionRequest?.ask.expand && (
          <PlanView
            key="permission-doc"
            shortline={permissionRequest.ask.askLine}
            plan={permissionRequest.ask.expand}
            onClose={() => setPermissionExpanded(false)}
            actions={
              <>
                <Button variant="ghost" size="sm" onClick={() => resolvePermission('deny')}>
                  {permissionRequest.ask.denyLabel}
                </Button>
                <Button size="sm" onClick={() => resolvePermission('allow')}>
                  {permissionRequest.ask.allowLabel}
                </Button>
              </>
            }
          />
        )}
      </AnimatePresence>

      {/* Curtain between sessions: the scene fades out, then ことね opens up again. */}
      <AnimatePresence>
        {changingSession && (
          <motion.div
            key="curtain"
            className="pointer-events-none fixed inset-0 z-[200] bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      <Toaster position="top-center" />
    </>
  )
}
