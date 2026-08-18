import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { Stage } from './Stage'
import { SpriteLayer } from './SpriteLayer'
import { DialogueBox } from './DialogueBox'
import { ReportView } from './ReportView'
import { UsagePanel } from './UsagePanel'
import { ContextPanel } from './ContextPanel'
import { AgentsPanel } from './AgentsPanel'
import { McpPanel } from './McpPanel'
import { StatusPanel } from './StatusPanel'
import { KeysPanel } from './KeysPanel'
import { CommandBar } from './CommandBar'
import { TroublePanel } from './TroublePanel'
import { ChatHistory } from './ChatHistory'
import { DemoRow } from './DemoRow'
import { InputBar } from './InputBar'
import { PermissionPrompt } from './PermissionPrompt'
import { ChoiceRow } from './ChoiceRow'
import { TodoBoard } from './TodoBoard'
import { WhisperZone } from './WhisperZone'
import { StatusBar } from './StatusBar'
import { SessionPlaque } from './SessionPlaque'
import { useSpeech, type Hooks } from './useSpeech'
import { alwaysCovers, readPermission, standingFor, type PermissionAsk } from './permission'
import { toast } from 'sonner'
import { createChatMessage, createPreviewHistory, recordToolResult, signLastMood } from './chatlog'
import { choreograph, type Scene } from './choreography'
import { applyWindowEvent, type WindowScene } from './windowEvents'
import type { ChatMessage, Expression, Phase, Whisper } from './types'
import { lines as currentLines } from './content'
import { fill, text } from '@/i18n'
import {
  INITIAL_LOOK,
  isLive,
  newSession,
  query,
  workingDirectory,
  type Attachment,
  type CafeCommand,
  type Look,
  type PermissionResult,
  type ModelChoice,
  type Question,
  type Report,
  type SessionSettings,
  type Lines,
  type Todo,
  type Trouble,
} from '@/agent'

/** The slash commands this window answers itself, instead of letting the CLI
 * print a flattened copy of the same figures — and `/keys`, which is the
 * window's own: the CLI has no such command because a terminal has no keys of
 * its own to explain. */
const SELF_ANSWERED = ['/usage', '/context', '/agents', '/mcp', '/status', '/keys'] as const
type SelfAnswered = (typeof SELF_ANSWERED)[number]

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

export function GalgameClient() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [readerOpen, setReaderOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expression, setExpression] = useState<Expression>('neutral')
  /** The 【…】 she signed her last line with, kept as she wrote it. Empty until
   * she has signed one — the window has nothing of its own to put there. */
  const [mood, setMood] = useState<string | null>(null)
  const [ctaVisible, setCtaVisible] = useState(false)
  const [laidOut, setLaidOut] = useState<string | null>(null)
  const [whispers, setWhispers] = useState<Whisper[]>([])
  // A real look is shot by the plugin once there is work to shoot; until then
  // there is nothing to peek at. The mock opens with a canned one.
  const [look, setLook] = useState<Look | null>(isLive ? null : INITIAL_LOOK)
  const [report, setReport] = useState<Report | null>(null)
  const [lookUnread, setLookUnread] = useState(true)
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)
  const [permissionExpanded, setPermissionExpanded] = useState(false)
  const [choiceRequest, setChoiceRequest] = useState<ChoiceRequest | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  /** How much she has written since the prompt went in — what the waiting line
   * counts up while he waits. Reset when a fresh prompt starts it over. */
  const [outputTokens, setOutputTokens] = useState(0)
  const [changingSession, setChangingSession] = useState(false)
  const [compacting, setCompacting] = useState(false)
  const [settings, setSettings] = useState<SessionSettings>({ model: null, effort: 'high', mode: 'default' })
  const [models, setModels] = useState<ModelChoice[]>([])
  const [commands, setCommands] = useState<CafeCommand[]>([])
  /** The slash command the window is answering itself, if any. */
  const [panel, setPanel] = useState<SelfAnswered | null>(null)
  /** Why she cannot work at all, when the session says so. */
  const [trouble, setTrouble] = useState<Trouble | null>(null)
  /** The conversation she is on, as the session last reported it. */
  const [conversation, setConversation] = useState<string | null>(null)
  /** The folder she is on. It changes under the window when she is sent
   * elsewhere, so it is state rather than something read once at startup. */
  const [folder, setFolder] = useState(workingDirectory ?? '')
  const [switching, setSwitching] = useState(false)
  /** The interface's language, which is not hers: a code, kept so switching it
   * redraws everything under this component. */
  const [locale, setLocale] = useState(window.cafe?.localeChoice ?? 'system')
  /** What she is speaking, as the session reports it — a sentence, not a code. */
  const [speech, setSpeech] = useState({ language: '', chosen: '' })
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
    queueLine(text, hooks)
  }

  /** Straight into the box — a question, an interruption, a new session. */
  function cut(text: string) {
    lastLineRef.current = text
    cutIn(text)
  }

  const appendChatMessage = useCallback(
    (role: ChatMessage['role'], content: string, report?: Report) => {
      setChatMessages((current) => [...current, createChatMessage(role, content, report)])
    },
    [],
  )

  /** The mood marker arrives with the result, after the line it belongs to is
   * already in the log. */
  const signLast = useCallback((mood?: string) => {
    setChatMessages((current) => signLastMood(current, mood))
  }, [])

  /** Things that happened between the spoken lines — tools, permissions,
   * interruptions. `output` is what it answered, when that is known already;
   * a tool call gets its answer later, by id. */
  const appendEvent = useCallback((content: string, detail?: string, toolId?: string, output?: string) => {
    setChatMessages((current) => [
      ...current,
      { ...createChatMessage('event', content, undefined, Date.now(), detail), toolId, output },
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
    if (expr) setExpression(expr)
    setMood(marker ?? null)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    cut(lines.greeting)
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
      setLines,
      setChatMessages,
      setTrouble,
      setPhase,
      setConversation,
      setExpression,
      setReport,
      setCtaVisible,
      setLaidOut,
      resetScene,
      cut,
      greetingRef,
      linesRef,
      lastLineRef,
    }
    const stop = window.cafe?.listen((event) => applyWindowEvent(event, windowScene))
    window.cafe?.refresh()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** ⌘K is where she is sent somewhere else — another folder, or back into a
   * conversation this one has had. ⌘L is the log, which is otherwise a button
   * on the plate and a row inside ⌘K — the one panel opened often enough to be
   * worth a key of its own, and the same key puts it away again. */
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      if (event.key === 'k') {
        event.preventDefault()
        setSwitching(true)
      } else if (event.key === 'l') {
        event.preventDefault()
        setHistoryOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

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
      if (readerOpen || permissionExpanded || historyOpen || switching || panel || trouble) return
      if (permissionRequest || choiceRequest) return
      event.preventDefault()
      stop()
    }
    window.addEventListener('keydown', interrupt)
    return () => window.removeEventListener('keydown', interrupt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, readerOpen, permissionExpanded, historyOpen, switching, panel, trouble, permissionRequest, choiceRequest])

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
      // Except while something else holds the scene — a report, a folded-out
      // permission, a panel — where there is no box to turn.
      if (readerOpen || permissionExpanded || historyOpen || switching || panel) return
      event.preventDefault()
      event.stopPropagation()
      advance()
    }
    window.addEventListener('keydown', turn, true)
    return () => window.removeEventListener('keydown', turn, true)
  }, [queued, isDone, advance, readerOpen, permissionExpanded, historyOpen, switching, panel])

  /** Only the reader blocks the scene now — a prompt sent while she is working
   * just queues up behind the one she is on. */
  function isBusy() {
    return readerOpen
  }


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
          setHistoryOpen(false)
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
          setHistoryOpen(false)
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
   * new session, a folder she was sent to, a conversation resumed. A report
   * and the mood it was signed with belonged to whatever she was saying
   * before; a standing "always allow" belonged to what she was doing before,
   * which is exactly why it does not follow her anywhere else.
   */
  function resetScene() {
    setLaidOut(null)
    setMood(null)
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

  /**
   * Start over in this folder. Everything the old session accumulated goes with
   * it — backlog, tasks, report, standing permissions — and ことね greets the
   * master again, the way she does at the start of any session.
   */
  function startNewSession() {
    if (changingSession) return
    stopEverything()
    permissionRef.current?.resolve({ behavior: 'deny' })
    askPermission(null)
    newSession()
    setChangingSession(true)

    window.setTimeout(() => {
      setPhase('idle')
      setReaderOpen(false)
      setHistoryOpen(false)
      setCtaVisible(false)
      setTodos([])
      setReport(null)
      resetScene()
      setChatMessages([createChatMessage('assistant', lines.greeting)])
      setExpression('neutral')
      setLook(isLive ? null : INITIAL_LOOK)
      setLookUnread(true)
      setChoiceRequest(null)
      cut(lines.greeting)
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
    setLaidOut(null)
    setCtaVisible(false)
    setTodos([])
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
        action: { label: text().scene.retry, onClick: () => tryRun(prompt) },
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
      else setPhase((standing) => (standing === 'working' ? 'idle' : standing))
    }
  }

  async function consume(controller: AbortController, prompt: string, images: Attachment[]) {
    const scene: Scene = {
      appendChatMessage,
      appendEvent,
      recordResult,
      signLast,
      say,
      act,
      wear,
      setExpression,
      pushWhisper,
      setPhase,
      setReport,
      setCtaVisible,
      setTodos,
      setOutputTokens,
      setLook,
      setLookUnread,
      setReaderOpen,
      setLaidOut,
      notify: (body) => window.cafe?.notify(body, false),
    }
    for await (const msg of query({ prompt, images, abortController: controller, canUseTool, askUser })) {
      choreograph(msg, scene)
    }
  }

  function openReport() {
    setReaderOpen(true)
  }

  // Just fold the panel back down — the spoken line and its read-more link stay,
  // so the report can be reopened as many times as the master likes.
  function closeReport() {
    setReaderOpen(false)
  }

  function tryRun(prompt: string) {
    if (isBusy()) return
    run(prompt)
  }

  /**
   * A slash command the window answers better than the session does. What
   * these print in a terminal is a flattening of figures the session will hand
   * over whole, so the panel asks for those instead of running a turn.
   */
  function handleSubmit(text: string, images: Attachment[] = []) {
    const said = text.trim()
    if (!said && !images.length) return
    const answered = SELF_ANSWERED.find((command) => command === said)
    if (answered) {
      setPanel(answered)
      return
    }
    if (said === '/resume' || said === '/cd') {
      setSwitching(true)
      return
    }
    run(said, images)
  }

  return (
    <>
      <Stage>
        <TodoBoard todos={historyOpen || readerOpen ? [] : todos} />
        <SpriteLayer expression={expression} />

        {/* The band above the box is where the whispers float; there is nothing
            to click there, so the pointer goes through it too. */}
        <div data-ghost className="absolute bottom-10 left-1/2 z-[6] w-[min(760px,92vw)] -translate-x-1/2">
          <WhisperZone whispers={whispers} />
          {!readerOpen && !permissionExpanded && (
            <DialogueBox
              line={line}
              laidOut={laidOut}
              isTyping={!isDone}
              isPast={past}
              isLoading={phase === 'working'}
              mood={mood}
              waiting={lines.waiting}
              outputTokens={outputTokens}
              queued={queued}
              onAdvance={advance}
              pace={pace}
              onPace={setPace}
              cta={ctaVisible ? (report?.label ?? null) : null}
              onOpenReport={openReport}
              utility={
                <SessionPlaque
                  onOpenHistory={() => setHistoryOpen(true)}
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
                    <DemoRow isDisabled={isBusy()} onSelect={tryRun} />
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

      {/* Clicking off the reader closes it. Nothing is painted here: the window
       * is transparent, so a dimmed sheet would darken the desktop behind her
       * rather than the scene — the reader carries its own solid card. */}
      {(readerOpen || permissionExpanded) && (
        <div
          className="fixed inset-0 z-[149]"
          onClick={readerOpen ? closeReport : () => setPermissionExpanded(false)}
        />
      )}

      <TroublePanel trouble={trouble} onClose={() => setTrouble(null)} />
      <UsagePanel open={panel === '/usage'} onClose={() => setPanel(null)} />
      <ContextPanel open={panel === '/context'} onClose={() => setPanel(null)} />
      <AgentsPanel open={panel === '/agents'} onClose={() => setPanel(null)} />
      <McpPanel open={panel === '/mcp'} onClose={() => setPanel(null)} />
      <StatusPanel open={panel === '/status'} onClose={() => setPanel(null)} />
      <KeysPanel open={panel === '/keys'} onClose={() => setPanel(null)} />
      <CommandBar
        open={switching}
        folder={folder}
        locale={locale}
        speech={speech}
        conversation={conversation}
        doing={{
          onNewSession: startNewSession,
          onOpenHistory: () => setHistoryOpen(true),
          onCompact: compactSession,
          onOpenPanel: setPanel,
          mode: settings.mode,
          onMode: (mode) => {
            setSettings((current) => ({ ...current, mode }))
            window.cafe?.configure({ mode })
          },
        }}
        onClose={(moved) => {
          setSwitching(false)
          if (!moved) return
          // Whatever she was in the middle of belongs to where he just left;
          // the scene starts over with what comes back.
          clearSpeech()
          setPhase('idle')
          setTodos([])
          setReport(null)
          setCtaVisible(false)
          resetScene()
        }}
      />

      <AnimatePresence>
        {readerOpen && report && (
          <ReportView
            key="report"
            shortline={lastLineRef.current}
            report={report.body}
            onClose={closeReport}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {permissionExpanded && permissionRequest?.ask.expand && (
          <ReportView
            key="permission-doc"
            shortline={permissionRequest.ask.askLine}
            report={permissionRequest.ask.expand}
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

      <ChatHistory
        open={historyOpen}
        messages={chatMessages}
        isBusy={phase === 'working'}
        isCompacting={compacting}
        isAwaitingAnswer={permissionRequest !== null || choiceRequest !== null}
        onClose={() => setHistoryOpen(false)}
        onCompact={compactSession}
        onNewSession={() => {
          setHistoryOpen(false)
          startNewSession()
        }}
      />
    </>
  )
}
