import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  characterForId,
  characterIds,
  characterVersion,
  charactersDir,
  shouldUpdateCharacter,
  syncPublishedCharacters,
} from "../src/characters.ts"

const SANDBOX = mkdtempSync(join(tmpdir(), "opencode-characters-test-"))
const previousRoot = process.env.XDG_CONFIG_HOME
const previousFetch = globalThis.fetch

function writePersona(id: string, version: string): void {
  const folder = join(charactersDir(), id)
  mkdirSync(folder, { recursive: true })
  writeFileSync(
    join(folder, "persona.md"),
    `---\nid: claudecafe/${id}\nname: ${id}\nversion: ${version}\n---\nBody.\n`,
    "utf8",
  )
}

beforeEach(() => {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(SANDBOX, { recursive: true })
  process.env.XDG_CONFIG_HOME = SANDBOX
})

afterEach(() => {
  if (previousRoot === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = previousRoot
  globalThis.fetch = previousFetch
})

test("character folders are discovered under the shared café root", () => {
  writePersona("newmaid", "1.0.0")
  expect(charactersDir()).toBe(join(SANDBOX, "claudecafe", "characters"))
  expect(characterIds()).toEqual(["newmaid"])
  expect(characterForId("newmaid")?.name).toBe("newmaid")
  expect(characterVersion("newmaid")).toBe("1.0.0")
})

test("version comparison updates only older published packs", () => {
  expect(shouldUpdateCharacter(null, "1.1.1")).toBe(true)
  expect(shouldUpdateCharacter("1.1.0", "1.1.1")).toBe(true)
  expect(shouldUpdateCharacter("1.1.1", "1.1.1")).toBe(false)
  expect(shouldUpdateCharacter("1.1.2", "1.1.1")).toBe(false)
})

test("a complete published pack does not trigger a download", async () => {
  for (const id of ["kotone", "kurumi", "kokona"]) writePersona(id, "1.2.0")
  let calls = 0
  globalThis.fetch = (() => {
    calls++
    throw new Error("network should not be used")
  }) as unknown as typeof fetch

  await syncPublishedCharacters()
  expect(calls).toBe(0)
})
