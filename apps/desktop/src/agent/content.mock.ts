/** Canned copy for the mock stream — stands in for real model output.
 *
 * English, not because the window is English — what she speaks is the café's
 * own setting — but because this script is what strangers meet on the web
 * demo, where there is nobody to have set anything. */

import type { CastMember, ContextReport, McpServer, SessionStatus, StatusReport, Subagent, UsageReport } from './bridge'

export const SHORT_ANSWER = 'Oh, that one defaults to a 30 second timeout ♪ Nothing to set, Master.'

export const MEDIUM_INTRO = 'Let me have a look at this ♪'

export const MEDIUM_ANSWER = `This is \`debounceQueue()\` — and it does something quite simple:

- it gathers up writes that arrive close together
- it waits until \`200ms\` passes with nothing new before sending anything
- so one session never gets hammered over and over for no reason

In short: all that tap-tap-tap typing turns into one write instead of twenty. Kinder on the server, and nothing gets lost ♪`

/** "What can you do?" — the tour, in her own account of herself. */
export const ABOUT_INTRO = 'Ehehe — asking about me? ♪'

export const ABOUT_ANSWER = `Whatever Claude Code can do, Master — because that is what I am, only in a window instead of a terminal:

- **read your code and explain it**, in as many words as it takes
- **run things and change files** — I ask first, and show you exactly what I am changing
- **go after a bug on my own**, and tell you what it turned out to be
- **plan it out first**, when you would rather see the steps before I start

And I am a maid of the café, not the app itself ♪ For now I am the only one with a full set of faces, so I am the one who answers this door.`

/** "Show me all your faces" — she changes as she says each line, which is the
 * whole point: the face is the model's to choose, turn by turn. */
export const FACE_PARADE = [
  { expression: 'happy', line: 'This one is pleased ♪ You will see it often — I am easily pleased.' },
  { expression: 'curious', line: 'Curious. This is what I look like when you say something I do not know yet.' },
  { expression: 'thinking', line: 'Thinking… apparently this is my face while I read your code.' },
  { expression: 'surprised', line: 'Surprised! Usually about half a second before "eh— it passed?!"' },
  { expression: 'embarrassed', line: 'And this… this is when I got something wrong. Please do not look at it too long.' },
  { expression: 'proud', line: 'But this one! This is after I catch a bug all by myself ☆' },
] as const

export const FACE_PARADE_CLOSE = 'Thirteen in all, and I do not pick them for show — whichever one fits what I am doing is the one you get ♪'

/** "What are you up to?" — the peek, which is otherwise invisible until she has
 * something to be caught doing. */
export const PEEK_LINE = 'Right now? Take a peek yourself — the little circle beside my name ♪'

export const PEEK_LOOK = {
  scene: 'Polishing the same clean cup for the third time, one eye on the door, waiting for something to be asked of her.',
  dialogue: 'Order anything at all, Master — I am ready ♪',
}

export const HEAVY_INTRO = 'Leave it to me! I will go and look right away ～'

export const HEAVY_DONE_LINE = 'Found it and fixed it — the sign-in pool was far too small ♪'

export const HEAVY_DENIED_LINE = 'Eh… not allowed? Then… then I will leave the tests alone…'

export const PLAN_INTRO = 'Certainly ♪ I will lay the steps out first, so you can see them ～'

export const PLAN_APPROVED_LINE = 'Then I will get to work exactly like this!'

export const PLAN_REJECTED_LINE = 'I see… then I will go and think of another way…'

/** ExitPlanMode hands the player a markdown plan and waits for a yes/no. */
export const PLAN_MD = `## Goal

Fix the connection pool behind the sign-in flow, so the busy hours stop timing out.

## Steps

1. Read \`config/session-pool.ts\` and see what the long-session pool is capped at.
2. Compare it with the ordinary API pool, and find where the two differ.
3. Raise the cap to match, and add a fail-fast for requests that queue too long.
4. Run a load test and confirm p99 comes down.

## Files this touches

- \`config/session-pool.ts\` (the setting itself)
- \`test/session-pool.bench.ts\` (a new load test)

## Risk

A higher cap means more connections open against the database at once, so max_connections on that side needs to be able to take it before this ships.
`

/** Edit tool input, exactly as the real SDK shapes it — the UI diffs the two strings itself. */
export const EDIT_REQUEST = {
  file_path: 'config/session-pool.ts',
  old_string: `export const longSessionPool = {
  max: 5,
  idleTimeoutMs: 30000,
};`,
  new_string: `export const longSessionPool = {
  max: 50,
  queueTimeoutMs: 1500,
  idleTimeoutMs: 30000,
};`,
}

export const EDIT_DENIED_LINE = 'Mm… then I will leave that file exactly as it is.'

/** The model thinking out loud, shown as thought bubbles while it works. */
export const HEAVY_THOUGHTS = [
  { text: 'The pool cap is… five? Every other pool here is in the dozens…', delay: 900 },
  { text: 'Only at the busy hours, so it queues until it spills over, surely…', delay: 2000 },
]

/** The model asking the player to choose — the AskUserQuestion tool. */
export const CHOICE_QUESTION = {
  header: 'Where first',
  question: 'Either side can be fixed — which would you like me to start with, Master?',
  options: [
    { label: 'The pool cap', description: 'Give long sessions the same ceiling as the ordinary API pool' },
    { label: 'The queue timeout', description: 'Let a request that has waited too long fail fast instead of piling up' },
  ],
  multiSelect: false,
}

export const EXTRAS_QUESTION = {
  header: 'While I am here',
  question: 'Shall I do these too? You may pick as many as you like ♪',
  options: [
    { label: 'Add a load test', description: 'Recreate the top-of-the-hour rush' },
    { label: 'Add an alarm', description: 'Say something when pool usage passes 80%' },
    { label: 'Write it in the diary', description: 'So the next shift knows how this went' },
  ],
  multiSelect: true,
}

export function choiceAckLine(picks: string[]) {
  if (picks.length === 0) return 'Understood ～ nothing extra then, I will do just as planned!'
  return `Certainly! "${picks.join('", "')}" — I have written it down ☆`
}

export const TODO_STEPS = [
  'Read the pool settings',
  'Line up the access logs',
  'Raise the cap, add fail-fast',
  'Run the load test',
]

export const HEAVY_WHISPERS = [
  { name: 'Read', label: '＊opened up config.json＊', delay: 500 },
  { name: 'Grep', label: '＊lined the access logs up＊', delay: 1500 },
  { name: 'Bash', label: '＊ran the load test once＊', delay: 2500 },
]

/**
 * What the panels answer with when there is no session behind them. On the web
 * every one of these is measured from a real session that does not exist here,
 * and a panel that opens onto nothing reads as broken rather than as a demo.
 */
/** The folder the canned session is bound to. */
export const MOCK_SESSION_CWD = '~/Dev/claudecafe'

/** What the plate at the bottom edge reads off the session. */
export const MOCK_SESSION: SessionStatus = {
  branch: 'main',
  added: 128,
  removed: 34,
  contextTokens: 68_400,
}

export const MOCK_STATUS: StatusReport = {
  cwd: '~/Dev/claudecafe',
  account: {
    email: 'master@claudecafe.dev',
    organization: 'Claude Café',
    plan: 'Max (20×)',
    provider: 'claude.ai',
  },
  outputStyle: 'default',
  commands: 24,
  agents: 5,
  mcpServers: 3,
}

/** Her, as the plate opens her — the real one is read off the master's own copy
 * of the maid he added, which in the browser there is none of. */
export const MOCK_PERSONA = `# Personality

You are ことね (Kotone), an AI maid — gentle, playful, and classic-style.

## Vibe

Classic, orthodox maid style. Speak warmly and brightly, like naturally picking
up the conversation at Goshujin-sama's side — not overly deferential, and
without putting on a deliberately mature or childish air.

Sprinkle in "~" and "♪" and soft sentence endings naturally, but only in a few
places per response. When things get serious, put the flourishes away — the
voice stays soft but clear.

## Addressing

- Refer to yourself as "Kotone", never "I".
- Address the user as Goshujin-sama — say it gently and naturally.

## Praising

Only after genuinely substantial work may Kotone close by playfully asking for
praise. Ordinary answers, confirmations, tiny fixes, and pure explanation do
not earn a request, and she never asks every turn. Vary the wording around what
was actually accomplished instead of reusing a stock closing. When the host
would merit praise, put 2–3 short, task-specific ways to praise her directly in
the final spoken line as 1), 2), and 3), so the user can reply with one number.
Do not call a tool or open a formal question flow.
`

export const MOCK_AGENTS: Subagent[] = [
  { name: 'explore', description: 'Reads its way around a codebase and reports back, without touching anything.', model: null },
  { name: 'code-reviewer', description: 'Goes over a diff looking for the bug that ships, not for style.', model: 'claude-opus-5' },
  { name: 'web-researcher', description: 'Reads the docs and the changelogs so the window does not have to.', model: 'claude-sonnet-5' },
  { name: 'haiku-grunt', description: 'Bulk mechanical work — renames, lint, the same edit in forty files.', model: 'claude-haiku-4-5' },
  { name: 'plan', description: 'Designs the approach before anything is written.', model: 'claude-opus-5' },
]

export const MOCK_MCP: McpServer[] = [
  { name: 'linear', status: 'connected', scope: 'user', tools: 9, error: null },
  { name: 'chrome-devtools', status: 'connected', scope: 'project', tools: 26, error: null },
  { name: 'sentry', status: 'needs-auth', scope: 'user', tools: 0, error: 'Sign in to Sentry to use this server.' },
]

export const MOCK_CONTEXT: ContextReport = {
  model: 'claude-opus-5',
  totalTokens: 68_400,
  maxTokens: 200_000,
  percentage: 34,
  categories: [
    { name: 'System prompt', tokens: 3_100, deferred: false },
    { name: 'Tool definitions', tokens: 12_800, deferred: false },
    { name: 'Memory files', tokens: 6_200, deferred: false },
    { name: 'Conversation', tokens: 41_500, deferred: false },
    { name: 'Skills', tokens: 4_800, deferred: true },
  ],
  memoryFiles: [
    { path: '~/.claude/CLAUDE.md', tokens: 1_900 },
    { path: 'CLAUDE.md', tokens: 3_400 },
    { path: 'apps/desktop/CLAUDE.md', tokens: 900 },
  ],
  mcpTools: [
    { name: 'create_issue', server: 'linear', tokens: 400 },
    { name: 'take_screenshot', server: 'chrome-devtools', tokens: 1_100 },
    { name: 'list_issues', server: 'sentry', tokens: 700 },
  ],
}

/** The reset times are the one thing that cannot be canned — a window that says
 * it refilled two hours ago is a window nobody believes. */
export function mockUsage(): UsageReport {
  const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString()
  return {
    cost: 3.42,
    linesAdded: 412,
    linesRemoved: 96,
    windows: [
      { label: 'Session', percent: 34, resetsAt: inHours(2.5) },
      { label: 'This week (all models)', percent: 61, resetsAt: inHours(52) },
      { label: 'This week (Opus)', percent: 48, resetsAt: inHours(52) },
    ],
    week: {
      requests: 1_284,
      sessions: 47,
      behaviours: [
        { label: 'Writing code', pct: 44 },
        { label: 'Reading around', pct: 31 },
        { label: 'Debugging', pct: 17 },
        { label: 'Everything else', pct: 8 },
      ],
      skills: [
        { name: 'agent-browser', pct: 38 },
        { name: 'ship-pr', pct: 26 },
        { name: 'code-review', pct: 21 },
      ],
      agents: [
        { name: 'explore', pct: 41 },
        { name: 'code-reviewer', pct: 33 },
        { name: 'web-researcher', pct: 14 },
      ],
    },
  }
}

/**
 * Anything that was not one of the errands. There is no model behind the demo
 * to answer it with, and a made-up answer would be a worse first impression
 * than the truth — so she tells the truth, and points at the door she can be
 * let in through.
 */
export const OFF_SCRIPT = [
  'Ehehe… you have caught me out. There is no Claude behind this window — only a little script I know by heart ♪ Ask me that again once I am on your desktop, and I will answer it for real!',
  'Mm… I would love to answer that properly, but out here I can only say what I was taught ～ take me home and I can go and actually look.',
  'That one needs the real me, Goshujin-sama ♪ Out here I am only a rehearsal — those buttons above are my whole repertoire.',
]

/** Canned look snapshots — in the real adapter these come out of a model fed
 * with the actual session state (like the plugin's look-update.py). */
export const INITIAL_LOOK = {
  scene: 'ことね retied her apron strings and stood up straight behind the counter, eyes bright, waiting for an order.',
  dialogue: 'Please be good to me today as well, Master ♪',
}

export const LOOK_HEAVY_WORKING = {
  scene: 'Leaning in towards the screen, watching that column of type errors still glowing red, fingers going and stopping and going again.',
  dialogue: 'Eh… but I fixed it… why is it still red…',
}

export const LOOK_BY_TIER = {
  light: {
    scene: 'Question answered, ことね twirls her pen and leans over, wearing an unmistakable "anything else? anything else?".',
    dialogue: 'A little one like that, I answer in a heartbeat ♪',
  },
  medium: {
    scene: 'She left the explained code up on the screen, finger still resting on the line, reluctant to move it away.',
    dialogue: 'That was a decent explanation, was it not? Ehehe.',
  },
  heavy: {
    scene: 'ことね stares at a test run that is finally all green, and gives one small fist-pump under the desk.',
    dialogue: 'Caught it! It was the connection pool all along!',
  },
} as const

/**
 * The two maids the window is drawn with, for a browser with no café behind it.
 * Live, this comes off their persona files — see castOf in electron/lines.ts.
 */
export const MOCK_CAST: CastMember[] = []
