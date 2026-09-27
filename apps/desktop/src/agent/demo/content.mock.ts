/** Canned copy for the mock stream — stands in for real model output.
 *
 * English, not because the window is English — what she speaks is the café's
 * own setting — but because this script is what strangers meet on the web
 * demo, where there is nobody to have set anything. */

import type { CastMember, SessionStatus, UsageReport } from '../bridge'
import { EXPRESSIONS } from '../expressions'

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

export const FACE_PARADE_CLOSE = `${EXPRESSIONS.length} in all, and I do not pick them for show — whichever one fits what I am doing is the one you get ♪`

export const HEAVY_INTRO = 'Leave it to me! I will go and look right away ～'

export const HEAVY_DONE_LINE = 'Found it and fixed it — the sign-in pool was far too small ♪'

export const HEAVY_DENIED_LINE = 'Eh… not allowed? Then… then I will leave the tests alone…'

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

export const TODO_STEPS = [
  'Read the pool settings',
  'Line up the access logs',
  'Raise the cap, add fail-fast',
  'Run the load test',
]

export const HEAVY_WHISPERS = [
  { name: 'Read', label: '＊opened up session-pool.ts＊', delay: 500 },
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
 * The maid the window is drawn with, for a browser with no café behind it. Her
 * art is copied beside the page by `ship:demo`. Live, this comes off the persona
 * files — see castOf in electron/characters/characters.ts.
 */
export const MOCK_CAST: CastMember[] = [
  {
    id: 'kotone',
    name: 'ことね',
    avatar: 'cast/kotone/avatar.webp',
    expressions: Object.fromEntries(EXPRESSIONS.map((face) => [face, `cast/kotone/portraits/${face}.webp`])),
  },
]
