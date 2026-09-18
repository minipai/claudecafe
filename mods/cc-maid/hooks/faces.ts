import type { RasterProps } from 'claude-code'
import { gunzip } from './inflate'
import packed from './faces/kotone.uniform'

/**
 * The expressions a .faces file holds, unpacked into what `Raster` draws.
 *
 * The file is base64 over gzip over three index planes per face — glyph,
 * foreground, background — against one shared palette. Unpacking every face
 * is one pass over the file, so it happens once at load and is kept.
 */
export type Face = Omit<RasterProps, 'key'>

export function loadFaces(source: string = packed): Record<string, Face> {
  return read(gunzip(base64(source)))
}

const DEFAULT_COLOR = 0x01000000 // the terminal's own colour, index 255 in a plane

function read(bytes: Uint8Array): Record<string, Face> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'CCF1') throw new Error('Not a .faces file')

  const columns = view.getUint16(4, true)
  const rows = view.getUint16(6, true)
  const colors = view.getUint16(8, true)
  const glyphCount = view.getUint8(10)
  const faceCount = view.getUint8(11)

  let at = 12
  const palette = new Uint32Array(colors)
  for (let i = 0; i < colors; i++, at += 4) palette[i] = view.getUint32(at, true)
  const glyphs = new Uint32Array(glyphCount)
  for (let i = 0; i < glyphCount; i++, at += 4) glyphs[i] = view.getUint32(at, true)

  const cells = columns * rows
  const faces: Record<string, Face> = {}
  for (let i = 0; i < faceCount; i++) {
    const length = view.getUint8(at++)
    const name = new TextDecoder().decode(bytes.subarray(at, at + length))
    at += length
    faces[name] = { columns, rows, cells: unpack(bytes.subarray(at, at + cells * 3), cells, palette, glyphs) }
    at += cells * 3
  }
  return faces
}

function unpack(planes: Uint8Array, cells: number, palette: Uint32Array, glyphs: Uint32Array): string {
  const words = new Uint32Array(cells * 3)
  for (let cell = 0; cell < cells; cell++) {
    words[cell * 3] = glyphs[planes[cell]!]!
    words[cell * 3 + 1] = color(planes[cells + cell]!, palette)
    words[cell * 3 + 2] = color(planes[cells * 2 + cell]!, palette)
  }
  return encode(new Uint8Array(words.buffer))
}

function color(index: number, palette: Uint32Array): number {
  return index === 255 ? DEFAULT_COLOR : palette[index]!
}

// --- base64, which the environment gives us in string form ---------------------

function base64(text: string): Uint8Array {
  const binary = atob(text.trim())
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function encode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}
