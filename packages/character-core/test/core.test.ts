import { describe, expect, test } from "bun:test"
import {
  commitAuthorship,
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
