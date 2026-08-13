import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { Stage } from './Stage'
import { SpriteLayer } from './SpriteLayer'
import { Backdrop } from './Backdrop'
import { DialogueBox } from './DialogueBox'
import { ReportView } from './ReportView'
import { UsagePanel } from './UsagePanel'
import { ContextPanel } from './ContextPanel'
import { AgentsPanel } from './AgentsPanel'
import { McpPanel } from './McpPanel'
import { StatusPanel } from './StatusPanel'
import { CommandBar } from './CommandBar'
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
import { faceFor } from '@/agent/expressions'
import { readPermission, type PermissionAsk } from './permission'
import { toast } from 'sonner'
import type { ChatMessage, Expression, Phase, Whisper } from './types'
import { AGENT_ERROR_TITLE, GREETING, INTERRUPTED_LINE } from './content'
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
  type Todo,
} from '@/agent'

/** The slash commands this window answers itself, instead of letting the CLI
 * print a flattened copy of the same figures. */
const SELF_ANSWERED = ['/usage', '/context', '/agents', '/mcp', '/status'] as const
type SelfAnswered = (typeof SELF_ANSWERED)[number]

type PermissionRequest = {
  ask: PermissionAsk
  resolve: (result: PermissionResult) => void
}

type ChoiceRequest = {
  question: Question
  resolve: (picks: string[]) => void
}

let whisperId = 0
let chatMessageId = 0

function createChatMessage(
  role: ChatMessage['role'],
  content: string,
  report?: Report,
  createdAt = Date.now(),
  detail?: string,
): ChatMessage {
  return {
    id: chatMessageId++,
    role,
    content,
    report,
    detail,
    createdAt,
  }
}

/** A notification is a glance, not a read: enough of her line to know what it
 * was about. */
function shorten(line: string) {
  return line.length > 160 ? `${line.slice(0, 158)}…` : line
}

/** Her line as she wrote it: the mood marker belongs on the record. */
function signed(line: string, mood?: string) {
  return mood ? `${line} ${mood}` : line
}

function createPreviewHistory() {
  const now = Date.now()
  return [
    createChatMessage('assistant', GREETING, undefined, now - 10 * 60_000),
    createChatMessage('user', '狀態列有點看不清楚，model 和 effort 還是要留著。', undefined, now - 8 * 60_000),
    createChatMessage('assistant', '好，ことね把文字對比提高，也把操作區重新排整齊了。', undefined, now - 7 * 60_000),
    createChatMessage('user', '可以讓我回看這次的對話嗎？', undefined, now - 3 * 60_000),
    createChatMessage('assistant', '可以，打開 LOG 就會看到目前對話的 BACKLOG。', undefined, now - 2 * 60_000),
  ]
}

export function GalgameClient() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [readerOpen, setReaderOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expression, setExpression] = useState<Expression>('neutral')
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
  const [changingSession, setChangingSession] = useState(false)
  const [compacting, setCompacting] = useState(false)
  const [settings, setSettings] = useState<SessionSettings>({ model: null, effort: 'high', mode: 'default' })
  const [models, setModels] = useState<ModelChoice[]>([])
  const [commands, setCommands] = useState<CafeCommand[]>([])
  /** The slash command the window is answering itself, if any. */
  const [panel, setPanel] = useState<SelfAnswered | null>(null)
  /** The conversation she is on, as the session last reported it. */
  const [conversation, setConversation] = useState<string | null>(null)
  /** The folder she is on. It changes under the window when she is sent
   * elsewhere, so it is state rather than something read once at startup. */
  const [folder, setFolder] = useState(workingDirectory ?? '')
  const [switching, setSwitching] = useState(false)
  // A real session starts empty; the canned backlog is only there to give the
  // mock something to show.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    isLive ? () => [createChatMessage('assistant', GREETING)] : createPreviewHistory,
  )
  const lastLineRef = useRef(GREETING)
  const abortControllerRef = useRef<AbortController | null>(null)
  /** What she has been told she may keep doing without asking again. Kept by
   * what was actually allowed — one yes to a command is not a yes to all of
   * them, and never to her editing files. */
  const alwaysAllowRef = useRef(new Set<string>())
  const permissionRef = useRef<PermissionRequest | null>(null)
  const running = useRef(0)
  /** Whether there has been a turn to skip to the end of since skip went on. */
  const ranWhileSkipping = useRef(false)

  const {
    line,
    isDone,
    say: queueLine,
    act,
    cut: cutIn,
    clear: clearSpeech,
    advance,
    hasMore,
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
    if (!mood) return
    setChatMessages((current) => {
      let last = current.length - 1
      while (last >= 0 && current[last].role !== 'assistant') last--
      if (last < 0) return current
      const signedMessages = [...current]
      signedMessages[last] = { ...current[last], content: signed(current[last].content, mood) }
      return signedMessages
    })
  }, [])

  /** Things that happened between the spoken lines — tools, permissions, interruptions. */
  const appendEvent = useCallback((content: string, detail?: string, toolId?: string) => {
    setChatMessages((current) => [
      ...current,
      { ...createChatMessage('event', content, undefined, Date.now(), detail), toolId },
    ])
  }, [])

  /** What a tool answered, put on the row that recorded the call. */
  const recordResult = useCallback((toolId: string, output: string, failed: boolean) => {
    setChatMessages((current) => {
      let at = current.length - 1
      while (at >= 0 && current[at].toolId !== toolId) at--
      if (at < 0) return current
      const withResult = [...current]
      withResult[at] = { ...current[at], output, failed }
      return withResult
    })
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
  function wear(expr?: Expression) {
    if (expr) setExpression(expr)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    cut(GREETING)
  }, [])

  /**
   * What belongs to the window rather than to a run: the look (shot in the
   * background, minutes after the turn that prompted it), the settings, and the
   * backlog — which comes from the transcript, so a reload gets it back.
   */
  useEffect(() => {
    const stop = window.cafe?.listen((event) => {
      if (event.kind === 'look') {
        setLook(event.look)
        setLookUnread(true)
      } else if (event.kind === 'settings') {
        setSettings(event.settings)
        setModels(event.models)
      } else if (event.kind === 'folder') {
        setFolder(event.cwd)
      } else if (event.kind === 'commands') {
        setCommands(event.commands)
      } else if (event.kind === 'backlog') {
        setConversation(event.sessionId)
        // Nothing has been said where she has just arrived: she opens up the way
        // she does at the start of any session, rather than standing there with
        // the last folder's line still in the box.
        if (!event.lines.length) {
          setChatMessages([createChatMessage('assistant', GREETING)])
          setExpression('neutral')
          cut(GREETING)
          return
        }
        setChatMessages(
          event.lines.map((entry) =>
            createChatMessage(entry.role, entry.content, undefined, entry.at),
          ),
        )
        // Her last line comes back to the box the way the scene wants it —
        // marker off, and worn on her face instead.
        const last = [...event.lines].reverse().find((entry) => entry.role === 'assistant')
        if (last) {
          const marker = last.content.match(/【[^【】]*】\s*$/)
          const face = marker && faceFor(marker[0])
          if (face) setExpression(face)
          cut(marker ? last.content.slice(0, marker.index).trim() : last.content)
        }
      }
    })
    window.cafe?.refresh()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** ⌘K is where she is sent somewhere else — another folder, or back into a
   * conversation this one has had. */
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.key !== 'k' || !(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      setSwitching(true)
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

  /**
   * Skipping is a run to the end, not a setting: once she has stopped working
   * and there is nothing left waiting, the scene comes back to hand. Armed
   * before a prompt it stays armed — there was never a run to reach the end of.
   */
  useEffect(() => {
    if (phase === 'working') {
      ranWhileSkipping.current = true
      return
    }
    if (!ranWhileSkipping.current || hasMore || !isDone) return
    ranWhileSkipping.current = false
    if (pace === 'skip') setPace('manual')
  }, [phase, hasMore, isDone, pace, setPace])

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
    if (alwaysAllowRef.current.has(ask.standing)) return { behavior: 'allow' as const }
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
      })
    })
  }

  function resolvePermission(behavior: 'allow' | 'deny', always = false) {
    const request = permissionRef.current
    if (!request) return
    if (always) alwaysAllowRef.current.add(request.ask.standing)
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
          setChoiceRequest({ question, resolve })
          window.cafe?.notify(question.question, true)
        },
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

  function stop() {
    abortControllerRef.current?.abort()
    permissionRef.current?.resolve({ behavior: 'deny' })
    askPermission(null)
    setChoiceRequest((current) => {
      current?.resolve([])
      return null
    })
    appendEvent('Interrupted by ご主人様')
    setPhase('idle')
    say(INTERRUPTED_LINE)
    appendChatMessage('assistant', INTERRUPTED_LINE)
  }

  /**
   * Start over in this folder. Everything the old session accumulated goes with
   * it — backlog, tasks, report, standing permissions — and ことね greets the
   * master again, the way she does at the start of any session.
   */
  function startNewSession() {
    if (changingSession) return
    abortControllerRef.current?.abort()
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
      setChatMessages([createChatMessage('assistant', GREETING)])
      setExpression('neutral')
      setLook(isLive ? null : INITIAL_LOOK)
      setLookUnread(true)
      alwaysAllowRef.current = new Set()
      setChoiceRequest(null)
      cut(GREETING)
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
    try {
      for await (const msg of query({ prompt: '/compact' })) {
        if (msg.type === 'system' && msg.subtype === 'compact_boundary') {
          setChatMessages((current) => [...current, createChatMessage('boundary', 'compacted')])
          toast.success('Context compacted', { description: 'Earlier turns are now a summary.' })
        }
      }
    } catch (error) {
      toast.error(AGENT_ERROR_TITLE, {
        description: error instanceof Error ? error.message : String(error),
      })
    }
    setCompacting(false)
  }

  // ---- consume the agent stream, drive the choreography off whatever it yields ----
  async function run(prompt: string, images: Attachment[] = []) {
    appendChatMessage('user', prompt)
    // The picture itself is hers to look at; the log records that it was handed
    // over, which is what the master will want to remember later.
    if (images.length) appendEvent(`Handed over ${images.length === 1 ? 'an image' : `${images.length} images`}`)
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

    const controller = new AbortController()
    abortControllerRef.current = controller
    running.current++

    try {
      await consume(controller, prompt, images)
    } catch (error) {
      // Anything the agent throws — a dropped connection, a refused request —
      // lands here. The scene stays put and the failure is reported as a toast.
      const message = error instanceof Error ? error.message : String(error)
      toast.error(AGENT_ERROR_TITLE, {
        description: message,
        action: { label: 'Retry', onClick: () => tryRun(prompt) },
      })
      appendEvent('Run failed', message)
      setPhase('idle')
      askPermission(null)
    } finally {
      // Another prompt may still be queued behind this one; the scene is only
      // done working once the last of them is.
      if (--running.current > 0) setPhase('working')
    }
  }

  async function consume(controller: AbortController, prompt: string, images: Attachment[]) {
    for await (const msg of query({ prompt, images, abortController: controller, canUseTool, askUser })) {
      switch (msg.type) {
        case 'system':
          break
        case 'text_delta':
          // Into the log the moment she says it — the log is the conversation as
          // it happens, not a summary written at the end of the turn.
          appendChatMessage('assistant', msg.text)
          say(msg.text, { onShow: () => wear(msg.expression) })
          break
        case 'look':
          setLook(msg.look)
          setLookUnread(true)
          break
        case 'command_output':
          // The café's own paperwork, handed over on the spot: it is not
          // dialogue, so nothing is typed into the box and her face stays put.
          appendEvent(msg.label, 'printed its own answer')
          setReport({ label: `${msg.label} →`, body: msg.body })
          setCtaVisible(true)
          setReaderOpen(true)
          // Nothing follows it — the turn asked no model and has no result to
          // put her back on her feet.
          setPhase('done')
          break
        case 'todos':
          // The board is part of the scene: it ticks over where it happened,
          // not while the master is still reading two lines back.
          act(() => setTodos(msg.todos))
          break
        case 'thinking':
          act(() => pushWhisper(msg.text, 'thought'))
          break
        case 'tool_use': {
          // The log is a record and keeps real time; the whisper and the face
          // belong to the scene, so they wait for the master to reach them.
          appendEvent(msg.label || msg.name, undefined, msg.id)
          if (msg.name === 'set_expression') {
            act(() => setExpression(msg.input?.expression as Expression))
          } else if (!msg.silent) {
            act(() => pushWhisper(msg.label, 'tool'))
          }
          break
        }
        case 'tool_result':
          recordResult(msg.id, msg.output, msg.failed)
          // A tool that failed is worth saying out loud in the scene; the rest
          // is only worth having on the record.
          if (msg.failed) act(() => pushWhisper('That did not work', 'tool'))
          break
        case 'result':
          // Done, and he is somewhere else: what she ended on is worth hearing
          // there rather than sitting unread in a window behind everything.
          window.cafe?.notify(shorten(msg.line), false)
          // The log keeps her line the way she wrote it, mood marker and all —
          // the scene is what strips it, to put the marker on her face instead.
          // A line already spoken is already logged; all the result adds is the
          // mood she signed off with.
          if (msg.said) signLast(msg.mood)
          else appendChatMessage('assistant', signed(msg.line, msg.mood), msg.report)
          if (msg.tier === 'heavy') {
            setPhase('done')
            setReport(msg.report ?? null)
            if (msg.said) setCtaVisible(true)
            else
              say(msg.line, {
                onShow: () => wear(msg.expression),
                onDone: () => setCtaVisible(true),
              })
            break
          }
          setPhase('idle')
          // Already on screen: the result is just the record of what she said.
          if (msg.said) break
          if (msg.tier === 'medium') {
            // Laid out rather than typed, but it still waits its turn behind
            // anything she said on the way here.
            say(msg.line, {
              onShow: () => {
                wear(msg.expression)
                setLaidOut(msg.line)
              },
            })
          } else {
            say(msg.line, { onShow: () => wear(msg.expression) })
          }
          break
      }
    }
  }

  function openReport() {
    setReaderOpen(true)
  }

  // Just fold the panel back down — the spoken line and the 展開全文 link stay,
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
        <Backdrop />
        <TodoBoard todos={historyOpen || readerOpen ? [] : todos} />
        <SpriteLayer expression={expression} />

        {/* The band above the box is where the whispers float; there is nothing
            to click there, so the pointer goes through it too. */}
        <div data-ghost className="absolute bottom-10 left-1/2 z-[6] w-[min(760px,92vw)] -translate-x-1/2">
          <WhisperZone whispers={whispers} />
          {!readerOpen && !permissionExpanded && (
            <DialogueBox
              expression={expression}
              line={line}
              laidOut={laidOut}
              isTyping={!isDone}
              isLoading={phase === 'working'}
              hasMore={hasMore}
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
                      key={choiceRequest.question.header}
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

      <AnimatePresence>
        {(readerOpen || permissionExpanded) && (
          <motion.div
            key="scrim"
            className="fixed inset-0 z-[149] bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={readerOpen ? closeReport : () => setPermissionExpanded(false)}
          />
        )}
      </AnimatePresence>

      <UsagePanel open={panel === '/usage'} onClose={() => setPanel(null)} />
      <ContextPanel open={panel === '/context'} onClose={() => setPanel(null)} />
      <AgentsPanel open={panel === '/agents'} onClose={() => setPanel(null)} />
      <McpPanel open={panel === '/mcp'} onClose={() => setPanel(null)} />
      <StatusPanel open={panel === '/status'} onClose={() => setPanel(null)} />
      <CommandBar
        open={switching}
        folder={folder}
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
