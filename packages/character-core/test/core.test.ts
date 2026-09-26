import { describe, expect, test } from "bun:test"
import {
  commitAuthorship,
  readContext,
  defaultFace,
  expressionToolDescription,
  fillPrompt,
  parsePersona,
  personaFiles,
  resolveCharacter,
} from "../src/index.ts"

describe("persona contracts", () => {
  test("parses frontmatter and strips the body", () => {
    const persona = parsePersona("---\nid: claudecafe/kotone\nname: ことね\nversion: 1.1.1\noff_duty: yes\n---\nBody.\n")
    expect(persona).toEqual({ id: "claudecafe/kotone", name: "ことね", version: "1.1.1", offDuty: true, body: "Body.\n" })
  })

  test("a variant is tried before the default persona", () => {
    expect(personaFiles()).toEqual(["persona.md"])
    expect(personaFiles("zh")).toEqual(["persona.zh.md", "persona.md"])
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

  test("none disables the character and random selection is bounded", () => {
    expect(resolveCharacter({ selected: "none", pool: ["kotone"] })).toBeNull()
    expect(resolveCharacter({ pool: ["kotone", "kurumi"], random: () => 0.99 })).toBe("kurumi")
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
  const makeHost = (config: { greeting?: boolean; festivals?: boolean | string } = {}) => ({
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

  test("greeting=false suppresses greeting, weather, and cues while retaining current context", async () => {
    const host = makeHost({ greeting: false })
    const text = await readContext(host, { cwd: "", language: "", startedAt: 0, greet: true })
    expect(text).not.toContain("Hello")
    expect(text).not.toContain("Weather")
    expect(text).not.toContain("Cues")
    expect(text).toContain("Current time:")
    expect(text).toContain("New Year's Day")
  })

  test("loads a custom festival file with home expansion and honors disabled festivals", async () => {
    const host = makeHost({ festivals: "~/days.json" })
    const custom = await readContext(host, { cwd: "", language: "", startedAt: 0, greet: false })
    expect(custom).toContain("Custom day")
    const disabled = await readContext(makeHost({ festivals: false }), { cwd: "", language: "", startedAt: 0, greet: false })
    expect(disabled).not.toContain("New Year's Day")
  })
})
