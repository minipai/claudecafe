import { describe, expect, test } from "bun:test"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { EXPRESSIONS } from "../src/expressions.ts"
import { loadFaces, renderFace } from "../src/faces.ts"

const charactersRoot = dirname(createRequire(import.meta.url).resolve("@claudecafe/characters/package.json"))
const faces = loadFaces(join(charactersRoot, "kotone", "expressions", "uniform", "panel.faces"))

describe("terminal faces", () => {
  test("the shared raster contains every expression", () => {
    expect(Object.keys(faces).sort()).toEqual([...EXPRESSIONS].sort())
  })

  test("the sidebar crop is styled text with the requested cell size", () => {
    const portrait = renderFace(faces.neutral!, 38, 25, 24)
    const lines = portrait.chunks.map((chunk) => chunk.text).join("").split("\n")

    expect(lines).toHaveLength(25)
    expect(lines.every((line) => [...line].length === 38)).toBe(true)
    expect(portrait.chunks.some((chunk) => chunk.fg || chunk.bg)).toBe(true)
  })
})
