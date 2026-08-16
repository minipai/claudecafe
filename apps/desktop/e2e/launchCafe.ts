import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron, expect, test as base, type ElectronApplication, type Locator, type Page } from '@playwright/test'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

export type Cafe = {
  app: ElectronApplication
  /** Her window. */
  page: Page
  /** The scratch folder she was opened on. */
  project: string
}

/**
 * Opens the fake-SDK build (`pnpm test:e2e` builds it first) in a scratch
 * $HOME and a scratch project folder, so a run never reads or writes the
 * real café. `os.homedir()` follows $HOME, which sandboxes `~/.claude`; the
 * window's own userData does not, hence `CAFE_USERDATA` (see main.ts).
 */
async function openCafe(): Promise<Cafe> {
  // Literally /tmp rather than os.tmpdir(): on macOS the latter resolves to
  // the long-form /var/folders/.../T path, and CommandBar's folder row
  // (label, the full path as a note, and a chevron all in one flex line —
  // see CommandBar.tsx) has no room left for the label once that note is
  // that long. /tmp is macOS's own symlink to the same place, just short.
  const home = await mkdtemp(path.join('/tmp', 'cafe-e2e-home-'))
  const userData = await mkdtemp(path.join('/tmp', 'cafe-e2e-userdata-'))
  const project = await mkdtemp(path.join('/tmp', 'cafe-e2e-project-'))

  const app = await electron.launch({
    args: [path.join(repoRoot, 'dist-electron/main.e2e.mjs'), `--dir=${project}`],
    env: { ...process.env, HOME: home, CAFE_USERDATA: userData },
  })
  app.once('close', () => {
    void Promise.all([rm(home, { recursive: true, force: true }), rm(userData, { recursive: true, force: true }), rm(project, { recursive: true, force: true })])
  })

  const page = await app.firstWindow()
  // Her greeting is the first thing the fake session has to say — waiting on
  // it is waiting on the window, the preload and the (fake) session all at
  // once, rather than on a fixed pause that outlives its reason the moment
  // any of those gets slower.
  await page.getByText('Goshujin-sama').first().waitFor()
  return { app, page, project }
}

/**
 * A `test` that opens her window as a fixture rather than a plain call, so
 * the teardown runs whether the spec's own assertions passed or not — a spec
 * that used to end on `await app.close()` left both the window and its three
 * scratch `/tmp` folders behind it whenever an assertion earlier in the body
 * threw, and with `workers: 1` the next spec's window had to fight the
 * leaked one for focus. `use()` throwing is exactly the failed-assertion
 * case, so the close lives in `finally` rather than after it.
 */
export const test = base.extend<{ cafe: Cafe }>({
  cafe: async ({}, use) => {
    const cafe = await openCafe()
    try {
      await use(cafe)
    } finally {
      await cafe.app.close()
    }
  },
})

/**
 * She is transparent and hands the pointer through empty space (see
 * useClickThrough); a target that has just appeared may not have had a
 * `mousemove` over it yet to take the pointer back, which is what a plain
 * `.click()` sometimes lands behind. Hovering first is that `mousemove`.
 */
export async function clickCafe(target: Locator) {
  await target.hover()
  await target.click()
}

/**
 * A line said mid-turn is not necessarily the one already on screen — she
 * says one thing at a time, and whatever follows a line already showing (an
 * answered permission, a stopped turn) queues up behind it. Turning the page
 * is Space (see the `turn` keydown handler in GalgameClient), and it does
 * nothing until the line on screen is done typing *and* something is
 * actually waiting behind it — the button reading "N more line(s)" is that
 * exact condition, on screen precisely when Space would do something. So
 * Space is only ever pressed here when that button is showing, never on a
 * guess: pressing it when nothing is queued is harmless, but pressing it
 * once the awaited line has already arrived can carry the scene straight
 * past it to whatever was queued next, and there would be nothing left on
 * screen for this to find.
 *
 * `exact: false` so a line already on screen is found by substring — the
 * `<span>` it renders into runs the text through `marked.parseInline` and
 * carries a caret alongside it while still typing, either of which can throw
 * off a whole-string match without changing what she actually said.
 *
 * What this can wait for: a line that is already showing, or one still to
 * come because something ahead of it is showing its "more" button. What it
 * cannot: a line the turn never queues at all, or one already advanced past
 * before this was ever called — both run out the 10s clock rather than
 * hanging on a Space that was never going to reveal it.
 */
export async function waitForLine(page: Page, text: string) {
  const line = page.getByText(text, { exact: false })
  const queuedBehind = page.getByRole('button', { name: /more lines?/ })
  await expect(async () => {
    if (!(await line.isVisible()) && (await queuedBehind.isVisible())) await page.keyboard.press(' ')
    await expect(line).toBeVisible({ timeout: 250 })
  }).toPass({ timeout: 10_000 })
  return line
}
