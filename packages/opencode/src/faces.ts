import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { RGBA, StyledText, type TextChunk } from "@opentui/core"

export type Face = {
  columns: number
  rows: number
  planes: Uint8Array
  palette: Uint32Array
  glyphs: Uint32Array
}

export function loadFaces(path: string): Record<string, Face> {
  const packed = readFileSync(path, "utf8")
  return read(gunzipSync(Buffer.from(packed.trim(), "base64")))
}

export function renderFace(face: Face, columns: number, rows: number, top: number): StyledText {
  const left = Math.floor((face.columns - columns) / 2)
  const chunks: TextChunk[] = []

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const upper = pixel(face, left + x, top + y * 2)
      const lower = pixel(face, left + x, top + y * 2 + 1)
      const cell = halfBlock(upper, lower)
      append(chunks, cell.text, cell.fg, cell.bg)
    }
    if (y < rows - 1) chunks.push({ __isChunk: true, text: "\n" })
  }

  return new StyledText(chunks)
}

function pixel(face: Face, x: number, y: number): number | undefined {
  const cells = face.columns * face.rows
  const cell = Math.floor(y / 2) * face.columns + x
  const glyph = face.glyphs[face.planes[cell]!]!
  const foreground = packedColor(face.planes[cells + cell]!, face.palette)
  const background = packedColor(face.planes[cells * 2 + cell]!, face.palette)

  if (glyph === 0x2580 && y % 2 === 0) return foreground
  if (glyph === 0x2584 && y % 2 === 1) return foreground
  return background
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

function read(bytes: Uint8Array): Record<string, Face> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "CCF1") throw new Error("Not a .faces file")

  const columns = view.getUint16(4, true)
  const rows = view.getUint16(6, true)
  const colorCount = view.getUint16(8, true)
  const glyphCount = view.getUint8(10)
  const faceCount = view.getUint8(11)

  let at = 12
  const palette = new Uint32Array(colorCount)
  for (let i = 0; i < colorCount; i++, at += 4) palette[i] = view.getUint32(at, true)
  const glyphs = new Uint32Array(glyphCount)
  for (let i = 0; i < glyphCount; i++, at += 4) glyphs[i] = view.getUint32(at, true)

  const cells = columns * rows
  const faces: Record<string, Face> = {}
  for (let i = 0; i < faceCount; i++) {
    const length = view.getUint8(at++)
    const name = new TextDecoder().decode(bytes.subarray(at, at + length))
    at += length
    faces[name] = {
      columns,
      rows,
      palette,
      glyphs,
      planes: bytes.slice(at, at + cells * 3),
    }
    at += cells * 3
  }
  return faces
}

function packedColor(index: number, palette: Uint32Array): number | undefined {
  return index === 255 ? undefined : palette[index]!
}

const rgbaColors = new Map<number, RGBA>()

function rgba(value: number): RGBA {
  const existing = rgbaColors.get(value)
  if (existing) return existing
  const color = RGBA.fromInts(value >> 16, (value >> 8) & 0xff, value & 0xff)
  rgbaColors.set(value, color)
  return color
}
