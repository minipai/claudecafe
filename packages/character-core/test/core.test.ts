import { describe, expect, test } from "bun:test"
import {
  commitAuthorship,
  compareVersions,
  readContext,
  defaultFace,
  expressionToolDescription,
  fillPrompt,
  markedFace,
  parsePersona,
  extendPersona,
  personaBody,
  resolveCharacter,
} from "../src/index.ts"

describe("persona contracts", () => {
  test("parses frontmatter and strips the body", () => {
    const persona = parsePersona("---\nid: claudecafe/kotone\nname: ことね\nversion: 1.1.1\noff_duty: yes\n---\nBody.\n")
    expect(persona).toEqual({ id: "claudecafe/kotone", name: "ことね", version: "1.1.1", offDuty: true, extends: "", waiting: [], body: "Body.\n" })
  })

  test("reads her waiting lines from a block list", () => {
    const persona = parsePersona("---\nname: ここな\nwaiting:\n  - 在看了，別催\n  - '快好了'\nquote: hi\n---\nBody.\n")
    expect(persona.waiting).toEqual(["在看了，別催", "快好了"])
    expect(parsePersona("---\nname: ここな\n---\nBody.\n").waiting).toEqual([])
  })

  test("a child persona overrides the fields and body it fills in, and keeps the parent's for the rest", () => {
    const parent = "---\nid: claudecafe/kokona\nname: ここな\noff_duty: true\nversion: 1.3.1\nwaiting:\n  - On it\n  - No rushing\n---\nBe sharp.\n"
    const child = "---\nname: ココナ\nextends: kokona\nversion:\nwaiting:\n  - 任せて\n---\n"
    const merged = extendPersona(child, parent)
    expect(merged).toBe("---\nid: claudecafe/kokona\nname: ココナ\nversion: 1.3.1\nwaiting:\n  - 任せて\n---\nBe sharp.\n")
    expect(parsePersona(merged).extends).toBe("")
    expect(personaBody(extendPersona(`${child}Be kind.\n`, parent))).toBe("Be kind.\n")
  })

  test("names the character a persona extends", () => {
    expect(parsePersona("---\nname: ココナ\nextends: kokona\n---\n").extends).toBe("kokona")
    expect(parsePersona("---\nname: ここな\n---\nBody.\n").extends).toBe("")
    expect(parsePersona("---\nextends: ../outside\n---\n").extends).toBe("")
  })

  test("versions compare numerically, and an unreadable one ties", () => {
    expect(compareVersions("1.10.0", "1.9.2")).toBe(1)
    expect(compareVersions("1.2", "1.2.1")).toBe(-1)
    expect(compareVersions("1.3.0", "1.3")).toBe(0)
    expect(compareVersions("", "1.3.0")).toBe(0)
  })

  test("authorship is derived from frontmatter", () => {
    const text = commitAuthorship("---\nid: claudecafe/kokona\nname: ここな\n---\nBody.\n")
    expect(text).toContain("Co-Authored-By: ここな <kokona@claudecafe.dev>")
    expect(text).not.toContain("id: claudecafe/kokona")
  })
})

describe("selection contracts", () => {
  test("explicit selection wins over every fallback", () => {
    expect(resolveCharacter({ selected: "kurumi", session: "kotone", config: "kokona", pool: ["a"] })).toBe("kurumi")
  })

  test("none disables the character and an unchosen one is always the same", () => {
    expect(resolveCharacter({ selected: "none", pool: ["kotone"] })).toBeNull()
    expect(resolveCharacter({ pool: ["kurumi", "kotone"] })).toBe("kotone")
    expect(resolveCharacter({ pool: ["kurumi", "kokona"] })).toBe("kurumi")
  })
})

describe("prompt and expression contracts", () => {
  test("prompt substitution preserves unknown and literal dollars", () => {
    expect(fillPrompt("Hi $name, $missing $$ done", { name: "K" })).toBe("Hi K, $missing $ done")
  })

  test("face defaults and descriptions are host-neutral", () => {
    expect(defaultFace(["happy", "neutral"])).toBe("neutral")
    expect(defaultFace([])).toBe("neutral")
    expect(expressionToolDescription(["happy"])).toContain("Available faces: happy")
  })
})

describe("shared context", () => {
  const makeHost = (config: { ambient_context?: boolean; festivals?: boolean | string } = {}) => ({
    now: async () => new Date(2026, 0, 1, 9, 5).getTime(),
    config: async () => config,
    readPrompt: async (name: "greeting" | "cues") => name === "greeting" ? "Hello at $time." : "Cues for $lang.",
    readFile: async () => '{"01-01":"Custom day"}',
    home: async () => "/home/test",
    weather: async () => "Sunny",
    commitsToday: async () => 2,
  })

  test("formats the first-turn greeting, elapsed time, commits, and default festival", async () => {
    const now = new Date(2026, 0, 1, 9, 5).getTime()
    const text = await readContext(makeHost(), { cwd: "/work", language: "Japanese", startedAt: now - 3_660_000, greet: true })
    expect(text).toContain("Hello at 09:05 (Thursday).")
    expect(text).toContain("Weather: Sunny")
    expect(text).toContain("Cues for Japanese.")
    expect(text).toContain("session 1h1m")
    expect(text).toContain("2 commits today")
    expect(text).toContain("New Year's Day")
  })

  test("ambient_context=false drops the greeting, weather and time line but keeps the mood cues", async () => {
    const host = makeHost({ ambient_context: false })
    const first = await readContext(host, { cwd: "/work", language: "", startedAt: 0, greet: true })
    expect(first).toBe("Cues for your reply language.")
    expect(await readContext(host, { cwd: "/work", language: "", startedAt: 0, greet: false })).toBe("")
  })

  test("loads a custom festival file with home expansion and honors disabled festivals", async () => {
    const host = makeHost({ festivals: "~/days.json" })
    const custom = await readContext(host, { cwd: "", language: "", startedAt: 0, greet: false })
    expect(custom).toContain("Custom day")
    const disabled = await readContext(makeHost({ festivals: false }), { cwd: "", language: "", startedAt: 0, greet: false })
    expect(disabled).not.toContain("New Year's Day")
  })
})

describe("mood markers", () => {
  test("a reply wears the face of the marker it ends on", () => {
    expect(markedFace("Fixed it♪\n【 開心 ＼(ˆ ᗜ ˆ)／ 】\n")).toBe("happy")
    expect(markedFace("【 開心 ＼(ˆ ᗜ ˆ)／ 】 and then more")).toBeNull()
    expect(markedFace("No marker at all.")).toBeNull()
  })
})
