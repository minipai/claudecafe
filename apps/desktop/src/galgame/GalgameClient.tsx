import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { Stage } from './Stage'
import { SpriteLayer } from './SpriteLayer'
import { DialogueBox } from './DialogueBox'
import { ReportView } from './ReportView'
import { ChatHistory } from './ChatHistory'
import { DemoRow } from './DemoRow'
import { InputBar } from './InputBar'
import { PermissionPrompt } from './PermissionPrompt'
import { ChoiceRow } from './ChoiceRow'
import { TodoBoard } from './TodoBoard'
import { WhisperZone } from './WhisperZone'
import { StatusBar } from './StatusBar'
import { SessionPlaque } from './SessionPlaque'
import { MEDIUM_ANSWER_TRANSCRIPT, MediumAnswer } from './MediumAnswer'
import { useTypewriter } from './useTypewriter'
import { readPermission, type PermissionAsk } from './permission'
import { toast } from 'sonner'
import type { ChatMessage, Expression, Phase, Whisper } from './types'
import { AGENT_ERROR_TITLE, GREETING, IDLE_NUDGE, INTERRUPTED_LINE } from './content'
import {
  INITIAL_LOOK,
  query,
  type Look,
  type PermissionResult,
  type Question,
  type Todo,
} from '@/agent'

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
  report?: string,
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
  const [showSpinner, setShowSpinner] = useState(false)
  const [showMedium, setShowMedium] = useState(false)
  const [ctaVisible, setCtaVisible] = useState(false)
  const [whispers, setWhispers] = useState<Whisper[]>([])
  const [look, setLook] = useState<Look>(INITIAL_LOOK)
  const [report, setReport] = useState('')
  const [lookUnread, setLookUnread] = useState(true)
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)
  const [permissionExpanded, setPermissionExpanded] = useState(false)
  const [choiceRequest, setChoiceRequest] = useState<ChoiceRequest | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [changingSession, setChangingSession] = useState(false)
  const [compacting, setCompacting] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(createPreviewHistory)
  const lastLineRef = useRef(GREETING)
  const abortControllerRef = useRef<AbortController | null>(null)
  const alwaysAllowRef = useRef(false)
  const permissionRef = useRef<PermissionRequest | null>(null)

  const { line, isDone, typeLine: rawTypeLine } = useTypewriter()

  function typeLine(text: string, onDone?: () => void) {
    lastLineRef.current = text
    rawTypeLine(text, onDone)
  }

  const appendChatMessage = useCallback(
    (role: ChatMessage['role'], content: string, report?: string) => {
      setChatMessages((current) => [...current, createChatMessage(role, content, report)])
    },
    [],
  )

  /** Things that happened between the spoken lines — tools, permissions, interruptions. */
  const appendEvent = useCallback((content: string, detail?: string) => {
    setChatMessages((current) => [
      ...current,
      createChatMessage('event', content, undefined, Date.now(), detail),
    ])
  }, [])

  function pushWhisper(text: string, kind: Whisper['kind']) {
    const id = whisperId++
    setWhispers((prev) => [...prev, { id, text, kind }])
    setTimeout(() => {
      setWhispers((prev) => prev.filter((w) => w.id !== id))
    }, kind === 'thought' ? 3200 : 2400)
  }

  function bounceTo(expr: Expression) {
    setExpression(expr)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    typeLine(GREETING)
  }, [])

  function isBusy() {
    return phase === 'working' || readerOpen
  }

  function goIdle(bounce: boolean) {
    setPhase('idle')
    if (bounce) bounceTo('neutral')
    else setExpression('neutral')
    setShowSpinner(false)
    setCtaVisible(false)
    typeLine(GREETING)
  }

  function collapseMedium() {
    setShowMedium(false)
    goIdle(true)
  }

  function askPermission(request: PermissionRequest | null) {
    permissionRef.current = request
    setPermissionRequest(request)
    if (!request) setPermissionExpanded(false)
  }

  async function canUseTool(toolName: string, input: Record<string, unknown>) {
    if (alwaysAllowRef.current) return { behavior: 'allow' as const }
    const ask = readPermission(toolName, input)
    // A question that blocks the run outranks whatever panel is open — come back
    // to the scene so it can actually be answered.
    setHistoryOpen(false)
    return new Promise<PermissionResult>((resolve) => {
      askPermission({ ask, resolve })
      typeLine(ask.askLine)
    })
  }

  function resolvePermission(behavior: 'allow' | 'deny', always = false) {
    const request = permissionRef.current
    if (!request) return
    if (always) alwaysAllowRef.current = true
    const verdict = behavior === 'allow' ? (always ? 'Allowed for this session' : 'Allowed') : 'Denied'
    appendEvent(`${verdict}: ${request.ask.title}`, request.ask.command)
    askPermission(null)
    request.resolve({ behavior })
  }

  /** AskUserQuestion: she asks, the footer turns into the choice branch. */
  async function askUser(question: Question) {
    setHistoryOpen(false)
    return new Promise<string[]>((resolve) => {
      setChoiceRequest({ question, resolve })
      typeLine(question.question)
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
    setExpression('neutral')
    setShowSpinner(false)
    typeLine(INTERRUPTED_LINE)
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
    setChangingSession(true)

    window.setTimeout(() => {
      setPhase('idle')
      setReaderOpen(false)
      setHistoryOpen(false)
      setShowMedium(false)
      setCtaVisible(false)
      setShowSpinner(false)
      setTodos([])
      setReport('')
      setChatMessages([createChatMessage('assistant', GREETING)])
      setExpression('neutral')
      setLook(INITIAL_LOOK)
      setLookUnread(true)
      alwaysAllowRef.current = false
      setChoiceRequest(null)
      typeLine(GREETING)
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
  async function run(prompt: string) {
    appendChatMessage('user', prompt)
    setPhase('working')
    setShowMedium(false)
    setCtaVisible(false)
    setTodos([])
    bounceTo('focused')

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      await consume(controller, prompt)
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
      setShowSpinner(false)
      setExpression('neutral')
      askPermission(null)
    }
  }

  async function consume(controller: AbortController, prompt: string) {
    for await (const msg of query({ prompt, abortController: controller, canUseTool, askUser })) {
      switch (msg.type) {
        case 'system':
          break
        case 'text_delta':
          setShowSpinner(true)
          typeLine(msg.text)
          break
        case 'look':
          setLook(msg.look)
          setLookUnread(true)
          break
        case 'todos':
          setTodos(msg.todos)
          break
        case 'thinking':
          pushWhisper(msg.text, 'thought')
          break
        case 'tool_use': {
          if (msg.name === 'set_expression') {
            setExpression(msg.input?.expression as Expression)
            break
          }
          appendEvent(msg.label || msg.name)
          pushWhisper(msg.label, 'tool')
          break
        }
        case 'result':
          setShowSpinner(false)
          if (msg.tier === 'light') {
            appendChatMessage('assistant', msg.line)
            typeLine(msg.line)
            setPhase('idle')
          } else if (msg.tier === 'medium') {
            appendChatMessage('assistant', MEDIUM_ANSWER_TRANSCRIPT)
            setShowMedium(true)
            setPhase('idle')
          } else {
            appendChatMessage('assistant', msg.line, msg.report)
            setPhase('done')
            setReport(msg.report ?? '')
            typeLine(msg.line, () => setCtaVisible(true))
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

  function handleDialogueClick() {
    if (phase === 'done') {
      openReport()
    } else if (showMedium) {
      collapseMedium()
    } else if (phase === 'idle') {
      typeLine(IDLE_NUDGE)
    }
  }

  function tryRun(prompt: string) {
    if (isBusy()) return
    run(prompt)
  }

  function handleSubmit(text: string) {
    if (isBusy() || !text.trim()) return
    run(text)
  }

  return (
    <>
      <Stage>
        <TodoBoard todos={historyOpen || readerOpen ? [] : todos} />
        <SpriteLayer expression={expression} fullBody={historyOpen} />

        <div className="absolute bottom-10 left-1/2 z-[6] w-[min(760px,92vw)] -translate-x-1/2">
          <WhisperZone whispers={whispers} />
          {!readerOpen && !historyOpen && !permissionExpanded && (
            <DialogueBox
              expression={expression}
              line={line}
              isTyping={!isDone}
              isLoading={showSpinner}
              showAdvanceTri={isDone}
              showMedium={showMedium}
              mediumContent={<MediumAnswer />}
              ctaVisible={ctaVisible}
              isClickable={phase === 'idle' || phase === 'done'}
              onOpenReport={openReport}
              onClick={handleDialogueClick}
              utility={<SessionPlaque onOpenHistory={() => setHistoryOpen(true)} />}
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
                  ) : (
                    <DemoRow isDisabled={isBusy()} onSelect={tryRun} />
                  )}
                  <InputBar
                    isDisabled={isBusy()}
                    isBusy={phase === 'working'}
                    onSubmit={handleSubmit}
                    onStop={stop}
                  />
                </>
              }
            />
          )}
        </div>

        <StatusBar />
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

      <AnimatePresence>
        {readerOpen && (
          <ReportView
            key="report"
            shortline={lastLineRef.current}
            report={report}
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
