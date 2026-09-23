import type { RasterProps } from 'claude-code'
import { decodeGif, type Image } from './gif'

/**
 * A pixel GIF unpacked into what `Raster` draws.
 *
 * Every cell is a half block holding two pixels stacked vertically; a
 * transparent pixel shows the terminal's own colour.
 */
export type Face = Omit<RasterProps, 'key'>

export function faceFromGif(base64: string): Face {
  return toFace(decodeGif(decode(base64)))
}

const DEFAULT_COLOR = 0x01000000 // the terminal's own colour
const BLANK = 0x20
const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584

function toFace(image: Image): Face {
  const columns = image.width
  const rows = Math.ceil(image.height / 2)
  const words = new Uint32Array(columns * rows * 3)
  for (let row = 0; row < rows; row++) {
    for (let x = 0; x < columns; x++) {
      const at = (row * columns + x) * 3
      words.set(halfBlock(pixel(image, x, row * 2), pixel(image, x, row * 2 + 1)), at)
    }
  }
  return { columns, rows, cells: encode(new Uint8Array(words.buffer)) }
}

function halfBlock(top: number | undefined, bottom: number | undefined): [number, number, number] {
  if (top === undefined && bottom === undefined) return [BLANK, DEFAULT_COLOR, DEFAULT_COLOR]
  if (top === bottom) return [BLANK, DEFAULT_COLOR, top!]
  if (top === undefined) return [LOWER_HALF, bottom!, DEFAULT_COLOR]
  return [UPPER_HALF, top, bottom ?? DEFAULT_COLOR]
}

function pixel(image: Image, x: number, y: number): number | undefined {
  if (y >= image.height) return undefined
  const at = (y * image.width + x) * 4
  if (image.pixels[at + 3] === 0) return undefined
  return image.pixels[at]! << 16 | image.pixels[at + 1]! << 8 | image.pixels[at + 2]!
}

// --- base64, which the environment gives us in string form ---------------------

function decode(text: string): Uint8Array {
  const binary = atob(text)
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
