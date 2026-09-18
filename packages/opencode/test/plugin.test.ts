import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import * as cafe from "../src/cafe.ts"
import { EXPRESSIONS } from "../src/expressions.ts"
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
const CHARACTERS = dirname(createRequire(import.meta.url).resolve("@claudecafe/characters/package.json"))

function write(path: string, text: string): void {
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, text, "utf8")
}

function setConfig(data: unknown): void {
  write(join(ROOT, "config.json"), JSON.stringify(data))
}

beforeEach(() => {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(SANDBOX, { recursive: true })
  // A fake café plugin root keeps the bundled nameless maid under the sandbox.
  write(join(BUNDLED, "maids", "noname.md"), "---\nname: ？？？\n---\nThe maid with no name.\n")
  process.env.XDG_CONFIG_HOME = SANDBOX
  process.env.CAFE_PLUGIN_ROOT = BUNDLED
  for (const name of ["OPENCODE_MAID", "CLAUDE_MAID", "OPENCODE_MAID_LANG", "CLAUDE_MAID_LANG"]) {
    delete process.env[name]
  }
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
  process.env.CAFE_PLUGIN_ROOT = join(import.meta.dir, "..", "..", "cafe")
}

describe("root and config", () => {
  test("root follows XDG_CONFIG_HOME", () => {
    expect(cafe.cafeRoot()).toBe(ROOT)
    process.env.XDG_CONFIG_HOME = join(SANDBOX, "elsewhere")
    expect(cafe.cafeRoot()).toBe(join(SANDBOX, "elsewhere", "claudecafe"))
  })

  test("missing, broken, and non-object configs are all empty", () => {
    expect(cafe.config()).toEqual({})
    write(join(ROOT, "config.json"), "{not json")
    expect(cafe.config()).toEqual({})
    write(join(ROOT, "config.json"), '"English"')
    expect(cafe.config()).toEqual({})
  })

  test("lang priority env > config > default", () => {
    expect(cafe.lang()).toBe(cafe.DEFAULT_LANG)
    setConfig({ lang: "日本語" })
    expect(cafe.lang()).toBe("日本語")
    process.env.CLAUDE_MAID_LANG = "Deutsch"
    expect(cafe.lang()).toBe("Deutsch")
    process.env.OPENCODE_MAID_LANG = "Français"
    expect(cafe.lang()).toBe("Français")
  })
})

describe("personas", () => {
  test("frontmatter is stripped and user files win over bundled", () => {
    write(join(ROOT, "personas", "noname.md"), "---\nname: My Maid\n---\nMine.\n")
    const path = cafe.personaFile("noname")
    expect(path).toBe(join(ROOT, "personas", "noname.md"))
    expect(cafe.personaBody(path ?? "").trim()).toBe("Mine.")
  })

  test("a retirement stub does not shadow an explicit pick", () => {
    write(join(ROOT, "personas", "noname.md"), "---\noff_duty: true\n---\n")
    expect(cafe.personaFile("noname")).toBe(join(BUNDLED, "maids", "noname.md"))
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

  test("hiring anyone relieves the nameless maid", () => {
    write(join(ROOT, "personas", "mymaid.md"), "---\nname: M\n---\nbody\n")
    expect(cafe.castPool()).toEqual(["mymaid"])
  })

  test("everyone off duty brings the nameless maid back", () => {
    write(join(ROOT, "personas", "mymaid.md"), "---\noff_duty: true\n---\n")
    expect(cafe.castPool()).toEqual(["noname"])
  })

  test("a stub retires the nameless maid too", () => {
    write(join(ROOT, "personas", "noname.md"), "---\noff_duty: true\n---\n")
    expect(cafe.castPool()).toEqual([])
  })

  test("uppercase filenames are never in the draw", () => {
    write(join(ROOT, "personas", "MyMaid.md"), "---\nname: M\n---\nbody\n")
    expect(cafe.castPool()).toEqual(["noname"])
  })

  test("builtin_cast false drops the nameless maid", () => {
    setConfig({ builtin_cast: false })
    expect(cafe.castPool()).toEqual([])
    write(join(ROOT, "personas", "mymaid.md"), "---\nname: M\n---\nbody\n")
    expect(cafe.castPool()).toEqual(["mymaid"])
  })
})

describe("commit authorship", () => {
  const PERSONA = `# Personality

Maid instructions.

## Git

When creating commits, use this Co-Authored-By line instead of the default:
\`Co-Authored-By: ここな <kokona@claudecafe.dev>\`
`

  test("co-author is the default and excludes --author", () => {
    const body = cafe.commitAuthorship(PERSONA)
    expect(body).toContain("`Co-Authored-By: ここな <kokona@claudecafe.dev>`")
    expect(body).toContain("Do not use `--author` for the maid.")
  })

  test("author mode swaps in the maid identity without a trailer", () => {
    setConfig({ commit_authorship: "author" })
    const body = cafe.commitAuthorship(PERSONA)
    expect(body).toContain('`--author="ここな <kokona@claudecafe.dev>"`')
    expect(body).toContain("the user remains committer")
    expect(body).not.toContain("Co-Authored-By:")
  })

  test("an unknown mode falls back to co-author", () => {
    setConfig({ commit_authorship: "surprise-me" })
    const body = cafe.commitAuthorship(PERSONA)
    expect(body).toContain("Co-Authored-By:")
    expect(body).not.toContain('`--author="')
  })

  test("a custom persona without the block is untouched", () => {
    const body = "# Personality\n\nCustom instructions.\n"
    expect(cafe.commitAuthorship(body)).toBe(body)
  })

  test("the Git section stops at the next heading", () => {
    const withTail = `${PERSONA}\n## Voice\n\nSpeak plainly.\n`
    const body = cafe.commitAuthorship(withTail)
    expect(body).toContain("## Voice\n\nSpeak plainly.")
    expect(body.indexOf("## Git")).toBeLessThan(body.indexOf("## Voice"))
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
    write(join(ROOT, "personas", "testmaid.md"), "---\nname: T\n---\nTest persona body.\n")
    process.env.OPENCODE_MAID = "testmaid"
    const { context: transform } = hooks()
    const output = context("sid")
    await transform(output)
    const injected = systemText(output)
    expect(injected).toContain("Test persona body.")
    expect(injected).toContain("Respond in English.")
    expect(injected).toContain("Mood marker")
    expect(injected).toContain("set_expression")
    expect(injected).toContain("Current time: ")
  })

  test("nobody on shift drops the persona but keeps the liveliness", async () => {
    setConfig({ maid: "none" })
    const { context: transform } = hooks()
    const output = context("sid")
    await transform(output)
    const injected = systemText(output)
    expect(injected).not.toContain("Adopt this persona")
    expect(injected).toContain("Mood marker")
  })

  test("a task subagent is skipped", async () => {
    write(join(ROOT, "personas", "testmaid.md"), "---\nname: T\n---\nBody.\n")
    process.env.OPENCODE_MAID = "testmaid"
    const { context: transform, event } = hooks()
    event({ type: "session.created", data: { sessionID: "child", parentID: "root" } })
    const output = context("child")
    await transform(output)
    expect(output.system).toHaveLength(1)
  })
})

describe("session briefing", () => {
  test("the greeting lands once in the session context", async () => {
    write(join(ROOT, "personas", "testmaid.md"), "---\nname: T\n---\nBody.\n")
    process.env.OPENCODE_MAID = "testmaid"
    const { context: transform } = hooks()
    const first = context("sid")
    await transform(first)
    expect(systemText(first)).toContain("local time is")
    const second = context("sid")
    await transform(second)
    expect(systemText(second)).not.toContain("local time is")
  })

  test("greeting false silences the briefing but still starts the shift clock", async () => {
    setConfig({ greeting: false, maid: "none" })
    const { context: transform } = hooks()
    const output = context("sid")
    await transform(output)
    expect(systemText(output)).not.toContain("local time is")
    expect(existsSync(join(cafe.stateDir("sid", false), "started-at"))).toBe(true)
  })

  test("the existing system context is preserved", async () => {
    setConfig({ maid: "none" })
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
    setConfig({ maid: "kokona" })
    write(join(ROOT, "personas", "kokona.md"), "---\nname: K\n---\nBody.\n")
    const { context: transform } = hooks()
    await transform({ sessionID: "sid", system: [] })
    expect(existsSync(shiftFile("sid"))).toBe(false)
  })
})

describe("expression tool", () => {
  test("set_expression stores the face shared with the TUI", async () => {
    let definition: { execute: (input: { expression: "happy" }) => Promise<{ content?: string }> } | undefined
    const stored: unknown[] = []
    const emitted: unknown[] = []
    let value: unknown
    let currentExpression: (() => Promise<{ expression: string }>) | undefined
    const cleanup = await plugin.setup({
      location: { directory: SANDBOX },
      event: { subscribe: () => emptyEvents() },
      rpc: {
        register: async (
          _definition: unknown,
          handlers: { expression: () => Promise<{ expression: string }> },
        ) => {
          currentExpression = handlers.expression
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
        get: async () => value,
        set: async (key: string, next: unknown) => {
          value = next
          stored.push({ key, value: next })
        },
      },
    } as never)

    expect(definition).toBeDefined()
    expect(await currentExpression?.()).toEqual({ expression: "neutral" })
    const result = await definition?.execute({ expression: "happy" })
    expect(result?.content).toBe("Expression: happy")
    expect(stored).toEqual([{ key: "expression", value: { value: "happy" } }])
    expect(emitted).toEqual([["expression", { expression: "happy" }]])
    expect(await currentExpression?.()).toEqual({ expression: "happy" })
    await cleanup?.()
  })

  test("every expression the tool offers has panel artwork", () => {
    for (const name of EXPRESSIONS) {
      expect(existsSync(join(CHARACTERS, "kotone", "expressions", "uniform", `${name}.webp`))).toBe(true)
    }
  })
})

async function* emptyEvents() {}
