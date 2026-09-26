import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as cafe from "../src/cafe.ts"
import { charactersDir, characterForId, PUBLISHED_CHARACTER_PACKS, characterVersion, shouldUpdateCharacter } from "../src/characters.ts"
import plugin from "../src/server.ts"

/**
 * Logic tests for the OpenCode café plugin — sandbox root, no network:
 *
 *     bun test ./test
 *
 * Covers the pure logic where the silent-failure bugs live: shift resolution,
 * the cast pool, persona files, festival packs, prompt substitution, and the
 * session context and expression tool that put it in front of the model.
 */

const SANDBOX = mkdtempSync(join(tmpdir(), "opencode-cafe-test-"))
const ROOT = join(SANDBOX, "claudecafe")
const BUNDLED = join(SANDBOX, "cafe-plugin")
const SOURCE_PIXELS = join(import.meta.dir, "..", "..", "characters", "kotone", "pixels")

function write(path: string, text: string): void {
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, text, "utf8")
}

function setConfig(data: unknown): void {
  write(join(ROOT, "config.json"), JSON.stringify(data))
}

function writeCharacter(id: string, name: string, body = "Character body.", version = "1.2.0"): void {
  write(
    join(charactersDir(), id, "persona.md"),
    `---\nid: claudecafe/${id}\nname: ${name}\nversion: ${version}\n---\n${body}\n`,
  )
}

function seedExpressionPack(id: string, name: string, faces: string[]): void {
  writeCharacter(id, name)
  for (const face of faces) {
    const target = join(charactersDir(), id, "pixels", `${face}.gif`)
    mkdirSync(join(charactersDir(), id, "pixels"), { recursive: true })
    copyFileSync(join(SOURCE_PIXELS, `${face}.gif`), target)
  }
}

beforeEach(() => {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(SANDBOX, { recursive: true })
  // A fake café plugin root keeps the bundled nameless maid under the sandbox.
  write(join(BUNDLED, "fallback", "noname.md"), "---\nname: ？？？\n---\nThe maid with no name.\n")
  process.env.XDG_CONFIG_HOME = SANDBOX
  // Keep the published packs out of the draw and make their sync a no-op.
  for (const { id, version } of PUBLISHED_CHARACTER_PACKS) {
    write(join(charactersDir(), id, "persona.md"), `---\nid: claudecafe/${id}\nname: ${id}\nversion: ${version}\noff_duty: true\n---\nbody\n`)
  }
  process.env.CAFE_PLUGIN_ROOT = BUNDLED
  // Offline: a failed weather fetch must degrade to silence.
  globalThis.fetch = (() => {
    throw new Error("offline")
  }) as unknown as typeof fetch
})

afterEach(() => {
  delete process.env.CAFE_PLUGIN_ROOT
})

// Point the prompt reader at the café's real files for the hook tests, which
// assert on prompt prose the plugin must actually ship.
function realPrompts(): void {
  process.env.CAFE_PLUGIN_ROOT = join(import.meta.dir, "..", "..", "persona-panel")
}

describe("root and config", () => {
  test("root follows XDG_CONFIG_HOME", () => {
    expect(cafe.cafeRoot()).toBe(ROOT)
    expect(charactersDir()).toBe(join(ROOT, "characters"))
    process.env.XDG_CONFIG_HOME = join(SANDBOX, "elsewhere")
    expect(cafe.cafeRoot()).toBe(join(SANDBOX, "elsewhere", "claudecafe"))
  })

  test("published character versions only update older packs", () => {
    expect(shouldUpdateCharacter("1.1.0", "1.1.1")).toBe(true)
    expect(shouldUpdateCharacter("1.1.1", "1.1.1")).toBe(false)
    expect(shouldUpdateCharacter("1.1.2", "1.1.1")).toBe(false)
    expect(shouldUpdateCharacter(null, "1.1.1")).toBe(true)
  })

  test("a character folder exposes its version and name", () => {
    writeCharacter("newmaid", "New", "Body.", "1.0.0")
    expect(characterVersion("newmaid")).toBe("1.0.0")
    expect(characterForId("newmaid")?.name).toBe("New")
  })

  test("missing, broken, and non-object configs are all empty", () => {
    expect(cafe.config()).toEqual({})
    write(join(ROOT, "config.json"), "{not json")
    expect(cafe.config()).toEqual({})
    write(join(ROOT, "config.json"), '"English"')
    expect(cafe.config()).toEqual({})
  })

  test("lang comes from config and is unset by default", () => {
    expect(cafe.lang()).toBe("")
    setConfig({ lang: "日本語" })
    expect(cafe.lang()).toBe("日本語")
  })
})

describe("personas", () => {
  test("the bundled nameless maid loads with her frontmatter stripped", () => {
    const path = cafe.personaFile("noname")
    expect(path).toBe(join(BUNDLED, "fallback", "noname.md"))
    expect(cafe.personaBody(path ?? "").trim()).toBe("The maid with no name.")
  })

  test("a local character folder is a persona source", () => {
    writeCharacter("mymaid", "My Pack", "Pack body.")
    expect(cafe.personaFile("mymaid")).toBe(join(charactersDir(), "mymaid", "persona.md"))
    expect(cafe.characterForMaid("mymaid")?.name).toBe("My Pack")
  })

  test("the variant picks its persona file, apart from the reply language", () => {
    writeCharacter("bilingual", "English", "English body.")
    write(join(charactersDir(), "bilingual", "persona.zh.md"), "---\nname: 中文\n---\n中文內容。\n")
    setConfig({ lang: "Traditional Chinese" })
    expect(cafe.personaFile("bilingual")).toBe(join(charactersDir(), "bilingual", "persona.md"))
    setConfig({ variant: "zh" })
    expect(cafe.personaFile("bilingual")).toBe(join(charactersDir(), "bilingual", "persona.zh.md"))
    setConfig({ variant: "ja" })
    expect(cafe.personaFile("bilingual")).toBe(join(charactersDir(), "bilingual", "persona.md"))
  })

  test("a missing persona resolves to nothing", () => {
    expect(cafe.personaFile("ghost")).toBeNull()
  })

  test("off_duty accepts true and yes, any case", () => {
    for (const value of ["true", "True", "yes", "YES"]) {
      expect(cafe.offDuty(`---\noff_duty: ${value}\n---\nbody`)).toBe(true)
    }
    expect(cafe.offDuty("---\noff_duty: false\n---\nbody")).toBe(false)
    expect(cafe.offDuty("body without frontmatter")).toBe(false)
  })
})

describe("cast pool", () => {
  test("an empty café falls back to the nameless maid", () => {
    expect(cafe.castPool()).toEqual(["noname"])
  })

  test("a manually added character folder joins the draw and relieves the nameless maid", () => {
    writeCharacter("newmaid", "New")
    expect(cafe.castPool()).toEqual(["newmaid"])
  })
})

describe("commit authorship", () => {
  const PERSONA = `---
id: claudecafe/kokona
name: ここな
---
# Personality

Maid instructions.
`

  test("co-author is the default and excludes --author", () => {
    const body = cafe.commitAuthorship(PERSONA)
    expect(body).toContain("`Co-Authored-By: ここな <kokona@claudecafe.dev>`")
    expect(body).toContain("Do not use `--author` for the character.")
    expect(body).toContain("Do not print the trailer in ordinary replies")
    expect(body).not.toContain("id: claudecafe/kokona")
  })

  test("author mode swaps in the maid identity without a trailer", () => {
    setConfig({ commit_authorship: "author" })
    const body = cafe.commitAuthorship(PERSONA)
    expect(body).toContain('`--author="ここな <kokona@claudecafe.dev>"`')
    expect(body).toContain("the user remains committer")
    expect(body).toContain("in ordinary replies")
    expect(body).not.toContain("Co-Authored-By:")
  })

  test("an unknown mode falls back to co-author", () => {
    setConfig({ commit_authorship: "surprise-me" })
    const body = cafe.commitAuthorship(PERSONA)
    expect(body).toContain("Co-Authored-By:")
    expect(body).not.toContain('`--author="')
  })

  test("a custom persona is untouched", () => {
    const body = "---\nid: mymaid\nname: M\n---\n# Personality\n\nCustom instructions.\n"
    expect(cafe.commitAuthorship(body)).toBe("# Personality\n\nCustom instructions.\n")
  })

  test("an older download's Git section gives way", () => {
    const legacy = `${PERSONA}
## Git

When creating commits, use this Co-Authored-By line instead of the default:
\`Co-Authored-By: ここな <kokona@claudecafe.dev>\`

## Voice

Speak plainly.
`
    const body = cafe.commitAuthorship(legacy)
    expect(body.split("## Git").length).toBe(2)
    expect(body.split("Co-Authored-By:").length).toBe(2)
    expect(body).toContain("## Voice\n\nSpeak plainly.")
  })
})

describe("prompts and festivals", () => {
  test("substitution leaves literal dollars and unknown placeholders", () => {
    write(join(BUNDLED, "prompts", "t.md"), "Hi $name, cost $5, $missing stays, $$ done\n")
    expect(cafe.prompt("t", { name: "kurumi" })).toBe("Hi kurumi, cost $5, $missing stays, $ done")
  })

  test("the built-in maid pack answers on maid-café days only", () => {
    expect(cafe.todayFestivals(new Date(2026, 4, 10))).toEqual(["Maid Day (メイドの日)"])
    expect(cafe.todayFestivals(new Date(2026, 8, 2))).toEqual([])
  })

  test("config false disables the calendar", () => {
    setConfig({ festivals: false })
    expect(cafe.todayFestivals(new Date(2026, 4, 10))).toEqual([])
  })

  test("a custom pack replaces the built-in one", () => {
    write(join(ROOT, "pack.json"), '{"05-10": "掃除の日"}')
    setConfig({ festivals: join(ROOT, "pack.json") })
    expect(cafe.todayFestivals(new Date(2026, 4, 10))).toEqual(["掃除の日"])
    expect(cafe.todayFestivals(new Date(2026, 1, 14))).toEqual([])
  })

  test("malformed packs degrade to silence", () => {
    const day = new Date(2026, 4, 10)
    setConfig({ festivals: join(ROOT, "nope.json") })
    expect(cafe.todayFestivals(day)).toEqual([])
    setConfig({ festivals: join(ROOT, "pack.json") })
    write(join(ROOT, "pack.json"), '["05-10"]')
    expect(cafe.todayFestivals(day)).toEqual([])
    write(join(ROOT, "pack.json"), '{"05-10": 42}')
    expect(cafe.todayFestivals(day)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// The hooks: what actually reaches the model.
// ---------------------------------------------------------------------------

function hooks(directory = SANDBOX) {
  realPrompts()
  return cafe.createCafe(directory)
}

function context(sessionID: string) {
  return { sessionID, system: [{ type: "text" as const, text: "base" }] }
}

function systemText(input: ReturnType<typeof context>): string {
  return input.system.map((part) => part.text).join("\n")
}

describe("system transform", () => {
  test("an explicit maid rides in the system prompt with the cues and the clock", async () => {
    writeCharacter("testmaid", "T", "Test persona body.")
    setConfig({ character: "testmaid" })
    const { context: transform } = hooks()
    const output = context("sid")
    await transform(output)
    const injected = systemText(output)
    expect(injected).toContain("Test persona body.")
    expect(injected).not.toContain("Respond in")
    expect(injected).toContain("Mood marker")
    expect(injected).toContain("set_expression")
    expect(injected).toContain("Current time: ")
  })

  test("a reply language asks for replies in it, with or without a maid", async () => {
    setConfig({ character: "none", lang: "Traditional Chinese" })
    const { context: transform } = hooks()
    const output = context("sid")
    await transform(output)
    expect(systemText(output)).toContain("Respond in Traditional Chinese.")
  })

  test("nobody on shift drops the persona but keeps the liveliness", async () => {
    setConfig({ character: "none" })
    const { context: transform } = hooks()
    const output = context("sid")
    await transform(output)
    const injected = systemText(output)
    expect(injected).not.toContain("Adopt this persona")
    expect(injected).toContain("Mood marker")
  })

  test("a task subagent is skipped", async () => {
    writeCharacter("testmaid", "T", "Body.")
    setConfig({ character: "testmaid" })
    const { context: transform, event } = hooks()
    event({ type: "session.created", data: { sessionID: "child", parentID: "root" } })
    const output = context("child")
    await transform(output)
    expect(output.system).toHaveLength(1)
  })
})

describe("session briefing", () => {
  test("the greeting lands once in the session context", async () => {
    writeCharacter("testmaid", "T", "Body.")
    setConfig({ character: "testmaid" })
    const { context: transform } = hooks()
    const first = context("sid")
    await transform(first)
    expect(systemText(first)).toContain("local time is")
    const second = context("sid")
    await transform(second)
    expect(systemText(second)).not.toContain("local time is")
  })

  test("greeting false silences the briefing but still starts the shift clock", async () => {
    setConfig({ greeting: false, character: "none" })
    const { context: transform } = hooks()
    const output = context("sid")
    await transform(output)
    expect(systemText(output)).not.toContain("local time is")
    expect(existsSync(join(cafe.stateDir("sid", false), "started-at"))).toBe(true)
  })

  test("the existing system context is preserved", async () => {
    setConfig({ character: "none" })
    const { context: transform } = hooks()
    const output = context("sid")
    await transform(output)
    expect(output.system[0]?.text).toBe("base")
  })
})

describe("shift persistence", () => {
  const shiftFile = (sessionID: string) => join(cafe.stateDir(sessionID, false), "on-shift")

  test("the draw is written to the session's shift file", async () => {
    const { context: transform } = hooks()
    await transform({ sessionID: "sid", system: [] })
    expect(readFileSync(shiftFile("sid"), "utf8").trim()).toBe("noname")
  })

  test("the fixed pick in config beats the draw and skips the shift file", async () => {
    setConfig({ character: "kokona" })
    writeCharacter("kokona", "K", "Body.")
    const { context: transform } = hooks()
    await transform({ sessionID: "sid", system: [] })
    expect(existsSync(shiftFile("sid"))).toBe(false)
  })

  test("the picker choice overrides the config for that session", async () => {
    writeCharacter("alpha", "Alpha", "Alpha body.")
    writeCharacter("beta", "Beta", "Beta body.")
    setConfig({ character: "beta" })
    const first = hooks()
    const selected = await first.selectMaid("sid", "alpha")
    expect(selected?.id).toBe("alpha")
    expect(readFileSync(join(cafe.stateDir("sid", false), "selected-maid"), "utf8")).toBe("alpha")

    const output = context("sid")
    await first.context(output)
    expect(systemText(output)).toContain("Alpha body.")

    const resumed = hooks()
    const resumedOutput = context("sid")
    await resumed.context(resumedOutput)
    expect(systemText(resumedOutput)).toContain("Alpha body.")
  })
})

describe("expression tool", () => {
  test("stores the active character's GIF face per session", async () => {
    seedExpressionPack("testmaid", "Test Maid", ["neutral", "happy", "focused"])
    seedExpressionPack("othermaid", "Other Maid", ["neutral"])
    setConfig({ character: "testmaid" })
    let definition: {
      execute: (
        input: { face: string },
        context: { sessionID: string },
      ) => Promise<{ content?: string }>
    } | undefined
    const values = new Map<string, unknown>()
    const writes: unknown[] = []
    const emitted: unknown[] = []
    let currentExpression:
      | ((input: { sessionID: string }) => Promise<{ character: string | null; face: string }>)
      | undefined
    let selectMaid:
      | ((input: { sessionID: string; maid: string }) => Promise<{ character: string | null; face: string }>)
      | undefined
    const cleanup = await plugin.setup({
      location: { directory: SANDBOX },
      event: { subscribe: () => emptyEvents() },
      rpc: {
        register: async (
          _definition: unknown,
          handlers: {
            expression: (input: { sessionID: string }) => Promise<{ character: string | null; face: string }>
            selectMaid: (input: { sessionID: string; maid: string }) => Promise<{ character: string | null; face: string }>
          },
        ) => {
          currentExpression = handlers.expression
          selectMaid = handlers.selectMaid
          return {
            events: { emit: async (...event: unknown[]) => emitted.push(event) },
            dispose: async () => {},
          }
        },
      },
      session: { hook: async () => ({ dispose: async () => {} }) },
      tool: {
        transform: async (register: (tools: { add: (tool: unknown) => void }) => void) => {
          register({ add: (tool) => (definition = tool as typeof definition) })
          return { dispose: async () => {} }
        },
      },
      storage: {
        get: async (key: string) => values.get(key),
        set: async (key: string, next: unknown) => {
          values.set(key, next)
          writes.push({ key, value: next })
        },
      },
    } as never)

    expect(definition).toBeDefined()
    expect(await currentExpression?.({ sessionID: "one" })).toEqual({ character: "testmaid", face: "neutral" })

    const result = await definition?.execute({ face: "happy" }, { sessionID: "one" })
    expect(result?.content).toBe("Face: happy")
    expect(writes).toEqual([{ key: "expression:one", value: { character: "testmaid", face: "happy" } }])
    expect(emitted).toEqual([
      ["expression", { sessionID: "one", character: "testmaid", face: "happy" }],
    ])

    await definition?.execute({ face: "focused" }, { sessionID: "two" })
    expect(await currentExpression?.({ sessionID: "one" })).toEqual({ character: "testmaid", face: "happy" })
    expect(await currentExpression?.({ sessionID: "two" })).toEqual({ character: "testmaid", face: "focused" })

    expect(await selectMaid?.({ sessionID: "one", maid: "othermaid" })).toEqual({ character: "othermaid", face: "neutral" })
    expect(await currentExpression?.({ sessionID: "one" })).toEqual({ character: "othermaid", face: "neutral" })
    expect(emitted.at(-1)).toEqual(["expression", { sessionID: "one", character: "othermaid", face: "neutral" }])
    await expect(definition?.execute({ face: "missing" }, { sessionID: "one" })).rejects.toThrow("not available")
    await cleanup?.()
  })
})

async function* emptyEvents() {}
