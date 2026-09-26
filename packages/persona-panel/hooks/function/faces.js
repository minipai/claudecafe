import { decodeGif } from './gif.js'

export function faceFromGif(base64) {
  return toFace(decodeGif(decode(base64)))
}

const DEFAULT_COLOR = 0x01000000
const BLANK = 0x20
const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584

function toFace(image) {
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

function halfBlock(top, bottom) {
  if (top === undefined && bottom === undefined) return [BLANK, DEFAULT_COLOR, DEFAULT_COLOR]
  if (top === bottom) return [BLANK, DEFAULT_COLOR, top]
  if (top === undefined) return [LOWER_HALF, bottom, DEFAULT_COLOR]
  return [UPPER_HALF, top, bottom ?? DEFAULT_COLOR]
}

function pixel(image, x, y) {
  if (y >= image.height) return undefined
  const at = (y * image.width + x) * 4
  if (image.pixels[at + 3] === 0) return undefined
  return image.pixels[at] << 16 | image.pixels[at + 1] << 8 | image.pixels[at + 2]
}

function decode(text) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function encode(bytes) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}
