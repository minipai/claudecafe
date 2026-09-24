import { readFileSync, readdirSync } from "node:fs"
import { extname, join } from "node:path"
import { RGBA, StyledText, type TextChunk } from "@opentui/core"
import { GifReader, type Frame } from "omggif"

export const FACE_COLUMNS = 36
export const FACE_ROWS = 48

export type FaceFrame = {
  pixels: Uint8ClampedArray
  delay: number
}

export type Face = {
  frames: FaceFrame[]
}

export function loadFaces(directory: string): Record<string, Face> {
  const files = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".gif")
    .sort((a, b) => a.name.localeCompare(b.name))

  const faces: Record<string, Face> = {}
  for (const file of files) {
    try {
      faces[file.name.slice(0, -extname(file.name).length)] = loadFace(join(directory, file.name))
    } catch {
      // One broken custom GIF should not hide the rest of the maid's faces.
    }
  }
  return faces
}

export function renderFace(face: Face, frameIndex = 0): StyledText {
  const frame = face.frames[frameIndex % face.frames.length]!
  const chunks: TextChunk[] = []

  for (let y = 0; y < FACE_ROWS; y += 2) {
    for (let x = 0; x < FACE_COLUMNS; x++) {
      const upper = pixel(frame.pixels, x, y)
      const lower = pixel(frame.pixels, x, y + 1)
      const cell = halfBlock(upper, lower)
      append(chunks, cell.text, cell.fg, cell.bg)
    }
    if (y < FACE_ROWS - 2) chunks.push({ __isChunk: true, text: "\n" })
  }

  return new StyledText(chunks)
}

function loadFace(path: string): Face {
  const bytes = readFileSync(path)
  const gif = new GifReader(bytes)
  if (gif.width !== FACE_COLUMNS || gif.height !== FACE_ROWS) {
    throw new Error(`${path} must be a ${FACE_COLUMNS}x${FACE_ROWS} GIF`)
  }

  const frames = decodeFrames(gif)
  if (frames.length === 0) throw new Error(`${path} has no image frames`)
  return { frames }
}

function decodeFrames(gif: GifReader): FaceFrame[] {
  const canvas = new Uint8ClampedArray(FACE_COLUMNS * FACE_ROWS * 4)
  const frames: FaceFrame[] = []

  for (let index = 0; index < gif.numFrames(); index++) {
    const frame = gif.frameInfo(index)
    const previous = frame.disposal === 3 ? canvas.slice() : undefined
    gif.decodeAndBlitFrameRGBA(index, canvas)
    frames.push({ pixels: canvas.slice(), delay: Math.max(frame.delay * 10 || 100, 20) })

    if (frame.disposal === 2) clearFrame(canvas, frame)
    if (previous) canvas.set(previous)
  }

  return frames
}

function clearFrame(canvas: Uint8ClampedArray, frame: Frame): void {
  for (let y = frame.y; y < frame.y + frame.height; y++) {
    canvas.fill(0, (y * FACE_COLUMNS + frame.x) * 4, (y * FACE_COLUMNS + frame.x + frame.width) * 4)
  }
}

function pixel(pixels: Uint8ClampedArray, x: number, y: number): number | undefined {
  const at = (y * FACE_COLUMNS + x) * 4
  if (pixels[at + 3] === 0) return undefined
  return pixels[at]! << 16 | pixels[at + 1]! << 8 | pixels[at + 2]!
}

function halfBlock(top: number | undefined, bottom: number | undefined): {
  text: string
  fg?: RGBA
  bg?: RGBA
} {
  if (top === undefined && bottom === undefined) return { text: " " }
  if (top === bottom) return { text: " ", bg: rgba(top!) }
  if (top === undefined) return { text: "▄", fg: rgba(bottom!) }
  return { text: "▀", fg: rgba(top), bg: bottom === undefined ? undefined : rgba(bottom) }
}

function append(chunks: TextChunk[], text: string, fg?: RGBA, bg?: RGBA): void {
  const previous = chunks.at(-1)
  if (previous && previous.fg === fg && previous.bg === bg) previous.text += text
  else chunks.push({ __isChunk: true, text, fg, bg })
}

const rgbaColors = new Map<number, RGBA>()

function rgba(value: number): RGBA {
  const existing = rgbaColors.get(value)
  if (existing) return existing
  const color = RGBA.fromInts(value >> 16, (value >> 8) & 0xff, value & 0xff)
  rgbaColors.set(value, color)
  return color
}
