import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/feedback/sonner'
import { Stage } from './scene/Stage'
import { SpriteLayer, type Reaction } from './character/SpriteLayer'
import { availableShift } from './character/cast'
import { ShiftPanel } from './character/ShiftPanel'
import { DialogueBox } from './dialogue/DialogueBox'
import { PlanView } from './permissions/PlanView'
import { WelcomePanel } from './panels/WelcomePanel'
import { PersonaPanel } from './panels/PersonaPanel'
import { TroublePanel } from './panels/TroublePanel'
import { DemoRow } from './input/DemoRow'
import { InputBar } from './input/InputBar'
import { PermissionPrompt } from './permissions/PermissionPrompt'
import { ChoiceRow } from './permissions/ChoiceRow'
import { WhisperZone } from './dialogue/WhisperZone'
import { StatusBar } from './panels/StatusBar'
import { PermissionMode, SessionPlaque } from './panels/SessionPlaque'
import { useSpeech, type Hooks } from './dialogue/useSpeech'
import { alwaysCovers, readPermission, standingFor, type PermissionAsk } from './permissions/permission'
import { toast } from 'sonner'
import { createChatMessage, createPreviewHistory, recordToolResult, upsertStreamMessage } from './scene/chatlog'
import { choreograph, type Scene } from './choreography'
import { applyWindowEvent, type WindowScene } from './windowEvents'
import type { CastMember, Shift } from '@/agent'
import type { ChatMessage, Expression, Phase, Whisper } from './types'
import { lines as currentLines } from './scene/content'
import { fill, her, nowServing, text } from '@/i18n'
import { listenToSideWindows, openSideWindow, shareScene } from '@/agent/windows'
import { WINDOW_KEYS } from '@/agent/windowKeys'
import {
  isLive,
  newSession,
  query,
  workingDirectory,
  type Attachment,
  type AgentMessage,
  type CafeCommand,
  type PermissionResult,
  type SceneAction,
  type SideWindow,
  type ModelChoice,
  type Question,
  type SessionSettings,
  type Lines,
  type Todo,
  type Trouble,
} from '@/agent'

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
  const [reaction, setReaction] = useState<Reaction | null>(null)
  const reactTo = useCallback((kind: Reaction['kind']) => {
    setReaction((previous) => ({ id: (previous?.id ?? 0) + 1, kind }))
  }, [])
  const [laidOut, setLaidOut] = useState<string | null>(null)
  const [whispers, setWhispers] = useState<Whisper[]>([])
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)
  const [permissionExpanded, setPermissionExpanded] = useState(false)
  const [choiceRequest, setChoiceRequest] = useState<ChoiceRequest | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  // Her board stays up while anything on it is still to do, across turns the
  // same as the CLI's, and goes once the last of it is ticked off.
  const board = useMemo(
    () => todos.some((todo) => todo.status !== 'completed') ? todos : [],
    [todos],
  )
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
  /** Why she cannot work at all, when the session says so. */
  const [trouble, setTrouble] = useState<Trouble | null>(null)
  /** The conversation she is on, as the session last reported it. */
  const [conversation, setConversation] = useState<string | null>(null)
  /** The folder she is on. It changes under the window when she is sent
   * elsewhere, so it is state rather than something read once at startup. */
  const [folder, setFolder] = useState(workingDirectory ?? '')
  /** The interface's language, which is not hers: what was picked (maybe
   * `system`) and the code it is drawn in, kept so switching it redraws
   * everything under this component — and the side windows with it. */
  const [locale, setLocale] = useState(() => ({
    choice: window.cafe?.localeChoice ?? 'system',
    drawn: window.cafe?.locale ?? navigator.language,
  }))
  /** What she is speaking, as the session reports it — a sentence, not a code. */
  const [speech, setSpeech] = useState({ language: '', chosen: '' })
  /** Read from the bridge so the first frame has the right maid. */
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
    streamed,
    say: queueLine,
    stream: streamLine,
    act,
    cut: cutIn,
    clear: clearSpeech,
    advance,
    previous,
    canPrevious,
    canNext,
    pageIndex,
    pageCount,
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

  function stream(id: string, content: string, done: boolean, hooks?: Hooks) {
    lastLineRef.current = content
    streamLine(id, content, done, {
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

  const updateStreamMessage = useCallback((id: string, content: string) => {
    setChatMessages((current) => upsertStreamMessage(current, id, content))
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
    if (failed) reactTo('error')
  }, [reactTo])

  function pushWhisper(text: string, kind: Whisper['kind']) {
    const id = whisperId++
    setWhispers((prev) => [...prev, { id, text, kind }])
    setTimeout(() => {
      setWhispers((prev) => prev.filter((w) => w.id !== id))
    }, kind === 'tool' ? 2400 : 3200)
  }

  /** The face that came with a line goes on as the line does, not when it was
   * written — she may have said three things since. */
  /** The face she signed a line with, put on when that line reaches the box. */
  function wear(expr?: Expression) {
    // A line with no face of its own leaves the current face where it is.
    if (expr) showFace(expr)
  }

  /** Put a face on. She has only been drawn wearing some of them: the rest
   * leave her standing neutral, and the kaomoji stands in beside her name so
   * the change is still visible — whether a tool asked for the face mid-turn
   * or she signed a line with it. */
  function showFace(expr: Expression) {
    setExpression(expr)
  }

  /** The same scene both prompted and unsolicited turns play through. Kept in
   * one place so a background completion is rendered with exactly the same
   * log, speech and expression semantics as an ordinary answer. */
  function currentScene(): Scene {
    return {
      appendChatMessage,
      upsertStreamMessage: updateStreamMessage,
      appendEvent,
      recordResult,
      say,
      stream,
      act,
      wear,
      showFace,
      pushWhisper,
      setPhase,
      setTodos,
      setOutputTokens,
      setLaidOut,
      notify: (body) => window.cafe?.notify(body, false),
    }
  }

  function playAmbient(message: AgentMessage) {
    // Task snapshots describe the board as it is now, not a beat in the
    // background scene. Keep them current even while dialogue or a run holds
    // that scene, and don't let stale snapshots wait around to be replayed.
    if (message.type === 'todos') {
      setTodos(message.todos)
      return
    }
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
   * What belongs to the window rather than to a run: the settings and the
   * backlog — which comes from the transcript, so a reload gets it back.
   */
  useEffect(() => {
    const windowScene: WindowScene = {
      setSettings,
      setModels,
      setFolder,
      setCommands,
      setSpeech,
      setLocale,
      // A removed maid is replaced by the first available character.
      setShift: (next: Shift) => setShift(availableShift(castRef.current, next)),
      setLines,
      setChatMessages,
      setTrouble: (next) => {
        setTrouble(next)
        if (next) reactTo('error')
      },
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
      settings: { locale: locale.choice, speech },
      model: { settings, models },
    })
  }, [locale, maid.name, folder, conversation, chatMessages, phase, compacting, permissionRequest, choiceRequest, board, speech, settings, models])

  /** What was clicked in them is done here, the way the scene would have done it. */
  const sideActionRef = useRef<(action: SceneAction) => void>(() => {})
  sideActionRef.current = (action) => {
    if (action.kind === 'compact') void compactSession()
    else if (action.kind === 'model') updateSettings({ model: action.model === 'default' ? null : action.model })
    else if (action.kind === 'effort') updateSettings({ effort: action.effort })
    else if (action.kind === 'new-session') startNewSession()
    else if (action.kind === 'return') window.focus()
    else if (action.kind === 'locale') window.cafe?.setLocale(action.choice)
    else if (action.kind === 'speech') window.cafe?.setSpeech(action.language)
    else if (action.kind === 'folder') {
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

  function updateSettings(patch: Partial<SessionSettings>) {
    setSettings((current) => ({ ...current, ...patch }))
    window.cafe?.configure(patch)
  }

  /** Electron owns live accelerators; the browser preview handles them here. */
  useEffect(() => {
    if (window.cafe) return
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      if (permissionExpanded || trouble) return
      const accelerator = `CmdOrCtrl+${event.shiftKey ? 'Shift+' : ''}${event.key === ',' ? ',' : event.key.toUpperCase()}`
      const target = WINDOW_KEYS.find((key) => key.accelerator === accelerator)?.window
      if (!target) return
      event.preventDefault()
      openSideWindow(target)
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
      if (permissionExpanded || personaOpen || trouble) return
      if (permissionRequest || choiceRequest) return
      event.preventDefault()
      stop()
    }
    window.addEventListener('keydown', interrupt)
    return () => window.removeEventListener('keydown', interrupt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, permissionExpanded, personaOpen, trouble, permissionRequest, choiceRequest])

  /** Arrow keys navigate dialogue unless focus or an unresolved scene action owns them. */
  useEffect(() => {
    const turn = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/i.test(target.tagName) || target.closest('[role="menu"], [role="menuitem"], [role="listbox"], [role="option"]'))) return
      if (permissionExpanded || pickingShift || personaOpen || trouble || permissionRequest || choiceRequest) return
      const canNavigate = event.key === 'ArrowLeft' ? canPrevious : canNext
      if (!canNavigate) return
      event.preventDefault()
      event.stopPropagation()
      setLaidOut(null)
      if (event.key === 'ArrowLeft') previous()
      else advance()
    }
    window.addEventListener('keydown', turn, true)
    return () => window.removeEventListener('keydown', turn, true)
  }, [advance, previous, canPrevious, canNext, permissionExpanded, pickingShift, personaOpen, trouble, permissionRequest, choiceRequest])


  function askPermission(request: PermissionRequest | null) {
    permissionRef.current = request
    setPermissionRequest(request)
    if (request) reactTo('attention')
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
          reactTo('attention')
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
    * new session, a folder she was sent to, a conversation resumed. A standing
    * "always allow" belonged to what she was doing before,
   * which is exactly why it does not follow her anywhere else.
   */
  function resetScene() {
    setLaidOut(null)
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
    reactTo('received')
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
      reactTo('error')
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
      if (msg.type === 'result' && !controller.signal.aborted) reactTo('finished')
    }
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
   * A slash command the window answers itself rather than sending it in as a
   * turn: one of its own windows, or the persona panel.
   */
  function handleSubmit(text: string, images: Attachment[] = []) {
    const said = text.trim()
    if (!said && !images.length) return
    if (said in WINDOW_COMMANDS) return openSideWindow(WINDOW_COMMANDS[said])
    if (said === '/persona') return setPersonaOpen(true)
    run(said, images)
  }

  return (
    <>
      <Stage>
        <SpriteLayer expression={expression} maid={maid} name={her()} reaction={reaction} />

        {/* The band above the box is where the whispers float; there is nothing
            to click there, so the pointer goes through it too. */}
        <div data-ghost className="absolute bottom-10 left-1/2 z-[6] w-[min(800px,92vw)] -translate-x-1/2">
          <WhisperZone whispers={whispers} />
          {!permissionExpanded && (
            <DialogueBox
              line={line}
              laidOut={laidOut}
              isTyping={!isDone}
              streamed={streamed}
              isPast={past}
              isLoading={phase === 'working'}
              waiting={lines.waiting}
              outputTokens={outputTokens}
              onPrevious={() => { setLaidOut(null); previous() }}
              onAdvance={() => { setLaidOut(null); advance() }}
              pageIndex={pageIndex}
              pageCount={pageCount}
              canPrevious={canPrevious && !permissionRequest && !choiceRequest}
              canNext={canNext && !permissionRequest && !choiceRequest}
              todos={board}
              onOpenReply={() => openSideWindow('reply')}
              onOpenPersona={chooseNewMaid}
              utility={<SessionPlaque settings={settings} models={models} />}
              onOpenHistory={() => openSideWindow('log')}
              controls={
                <div className="flex items-center gap-1">
                  <form onSubmit={(event) => { event.preventDefault(); void compactSession() }}>
                    <button type="submit" className="h-7 cursor-pointer border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors enabled:hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-50" disabled={phase === 'working' || compacting}>{compacting ? text().log.compacting : text().log.compact}</button>
                  </form>
                  <form onSubmit={(event) => { event.preventDefault(); startNewSession() }}>
                    <button type="submit" className="h-7 cursor-pointer border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors enabled:hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-50" disabled={phase === 'working' || changingSession}>{text().scene.newAction}</button>
                  </form>
                </div>
              }
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
                  <div className="relative z-10 mx-3 -mt-3 translate-y-[18px]">
                  <InputBar
                        isBusy={phase === 'working'}
                        commands={commands}
                        onSubmit={handleSubmit}
                        onStop={stop}
                        footer={<StatusBar folder={folder} />}
                        actions={<PermissionMode settings={settings} onChange={updateSettings} />}
                  />
                  </div>
                </>
              }
            />
          )}
        </div>
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
