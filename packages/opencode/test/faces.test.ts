import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { FACE_DIRECTORY, loadFaceNames } from "../src/expressions.ts"
import { loadFaces, renderFace } from "../src/faces.ts"

const faces = loadFaces(FACE_DIRECTORY)

describe("terminal faces", () => {
  test("the available faces come from GIF filenames", () => {
    expect(Object.keys(faces)).toEqual(loadFaceNames())
  })

  test("a 36x48 GIF renders as 36x24 styled terminal cells", () => {
    const portrait = renderFace(faces.neutral!)
    const lines = portrait.chunks.map((chunk) => chunk.text).join("").split("\n")

    expect(lines).toHaveLength(24)
    expect(lines.every((line) => [...line].length === 36)).toBe(true)
    expect(portrait.chunks.some((chunk) => chunk.fg || chunk.bg)).toBe(true)
  })

  test("animated GIF frames and their delays are retained", () => {
    const animated = loadFaces(join(import.meta.dir, "fixtures", "animated")).blink!

    expect(animated.frames).toHaveLength(2)
    expect(animated.frames.map((frame) => frame.delay)).toEqual([80, 120])
    expect(renderFace(animated, 0).chunks).not.toEqual(renderFace(animated, 1).chunks)
  })
})
