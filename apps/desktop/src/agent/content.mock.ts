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
- **go after a bug on my own**, and hand you a written report at the end
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

export const HEAVY_DONE_LINE = 'All written up! Please have a look, Master ♪'

export const HEAVY_DENIED_LINE = 'Eh… not allowed? Then… then I will leave the tests alone…'

export const HEAVY_REPORT_MD = `# Intermittent timeouts in the sign-in flow

**INCIDENT REPORT #482**　Looked into by ことね｜Status: fixed｜Took: 14 minutes

## What was happening

Over the last 24 hours about 3% of sign-ins stalled while the session was being created. The visitor sat on "please wait" for more than 8 seconds and then failed outright. The failures clustered around the top of each hour, and only ever hit sign-ins with "remember me" ticked.

## How I found it

I lined the peak-hour access logs up against each other, and every timed-out request was stuck in the same place — the write that stores the long-lived session token. Following that upstream landed on the connection pool:

> ＊opened up config.json, and found the long-session pool capped at 5 — where the ordinary API pool is allowed 50.＊

Once enough "remember me" sign-ins arrive at the same moment, those 5 connections are all busy and everyone else queues, right up until they time out. Which is also why it only bites near the top of the hour: that is when people sign in together.

## The fix

Give the long-session pool the same ceiling as the ordinary API pool, and let a request that has queued too long fail fast instead of piling up:

\`\`\`ts
// config/session-pool.ts
export const longSessionPool = {
  max: 50,              // 5 → 50, matching the ordinary API pool
  queueTimeoutMs: 1500, // new: queue longer than 1.5s and fail fast
  idleTimeoutMs: 30000,
};
\`\`\`

I also wrote a small load test that recreates the top-of-the-hour rush, and under the new setting p99 comes down from 8.2s to 210ms.

## What I would suggest next

- Put an alarm on pool usage at 80%, so this says something before a visitor has to.
- The "remember me" path could batch its writes, which would flatten the peak rather than survive it.
- Next time a pool gets resized, please land it with a load test attached ～ I was going on instinct this time, and it was a little scary.

> ＊closed the notebook, gave a satisfied little nod＊ —— and that is the whole story, Master. Thank you for your hard work!
`

/** In a real session she writes the link's wording herself, per report. */
export const HEAVY_REPORT = { label: 'See what I dug up →', body: HEAVY_REPORT_MD }

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
 * of the maid he hired, which in the browser there is none of. */
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

After finishing a task, close the reply by playfully asking for a word of
praise. When praised: be happily, affectionately delighted.
`

export const MOCK_AGENTS: Subagent[] = [
  { name: 'explore', description: 'Reads its way around a codebase and reports back, without touching anything.', model: null },
  { name: 'code-reviewer', description: 'Goes over a diff looking for the bug that ships, not for style.', model: 'claude-opus-5' },
  { name: 'web-researcher', description: 'Reads the docs and the changelogs so the window does not have to.', model: 'claude-sonnet-5' },
  { name: 'haiku-grunt', description: 'Bulk mechanical work — renames, lint, the same edit in forty files.', model: 'claude-haiku-4-5' },
  { name: 'plan', description: 'Designs the approach before anything is written.', model: 'claude-opus-5' },
]

export const MOCK_MCP: McpServer[] = [
  { name: 'cafe-bell', status: 'connected', scope: 'user', tools: 4, error: null },
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
    { name: 'ring', server: 'cafe-bell', tokens: 400 },
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
export const MOCK_CAST: CastMember[] = [
  { id: 'kotone', name: 'ことね', outfits: [{ id: 'uniform', label: '女僕裝' }, { id: 'one-piece', label: '連身裙' }] },
  { id: 'kurumi', name: 'くるみ', outfits: [{ id: 'uniform', label: '女僕裝' }] },
]
