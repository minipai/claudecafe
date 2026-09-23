/**
 * The first frame of a GIF as RGBA, because a hooks module has no image codecs.
 *
 * Covers what an image editor may write: a global or local palette, one
 * transparent index from the graphic control extension, interlaced rows, a
 * frame smaller than the canvas, and LZW codes of growing width.
 */
export type Image = { width: number; height: number; pixels: Uint8Array }

export function decodeGif(bytes: Uint8Array): Image {
  const signature = String.fromCharCode(...bytes.subarray(0, 6))
  if (signature !== 'GIF87a' && signature !== 'GIF89a') throw new Error('Not a GIF')

  const width = u16(bytes, 6)
  const height = u16(bytes, 8)
  let at = 13
  let palette: Uint8Array = new Uint8Array(0)
  if (bytes[10]! & 0x80) {
    palette = bytes.subarray(at, at + paletteSize(bytes[10]!))
    at += palette.length
  }

  let transparent = -1
  for (;;) {
    const block = bytes[at++]
    if (block === 0x21) {
      if (bytes[at] === 0xf9 && bytes[at + 2]! & 1) transparent = bytes[at + 5]!
      at = skipBlocks(bytes, at + 1)
    } else if (block === 0x2c) {
      return { width, height, pixels: decodeFrame(bytes, at, width, height, palette, transparent) }
    } else {
      throw new Error('GIF has no image')
    }
  }
}

function decodeFrame(
  bytes: Uint8Array, at: number, width: number, height: number, palette: Uint8Array, transparent: number,
): Uint8Array {
  const left = u16(bytes, at)
  const top = u16(bytes, at + 2)
  const frameWidth = u16(bytes, at + 4)
  const frameHeight = u16(bytes, at + 6)
  const flags = bytes[at + 8]!
  at += 9
  if (flags & 0x80) {
    palette = bytes.subarray(at, at + paletteSize(flags))
    at += palette.length
  }

  const minimumSize = bytes[at++]!
  const indices = lzw(joinBlocks(bytes, at), minimumSize, frameWidth * frameHeight)
  const rows = flags & 0x40 ? interlacedRows(frameHeight) : [...Array(frameHeight).keys()]

  const pixels = new Uint8Array(width * height * 4)
  rows.forEach((y, row) => {
    for (let x = 0; x < frameWidth; x++) {
      const index = indices[row * frameWidth + x]!
      const canvasX = left + x
      const canvasY = top + y
      if (index === transparent || canvasX >= width || canvasY >= height) continue
      const out = (canvasY * width + canvasX) * 4
      pixels.set(palette.subarray(index * 3, index * 3 + 3), out)
      pixels[out + 3] = 255
    }
  })
  return pixels
}

/** GIF's LZW: codes start one bit wider than the minimum size and grow to 12. */
function lzw(data: Uint8Array, minimumSize: number, count: number): Uint8Array {
  const out = new Uint8Array(count)
  const clear = 1 << minimumSize
  const end = clear + 1
  const prefix = new Uint16Array(4096)
  const suffix = new Uint8Array(4096)
  const first = new Uint8Array(4096)
  const length = new Uint16Array(4096)
  for (let code = 0; code < clear; code++) {
    suffix[code] = first[code] = code
    length[code] = 1
  }

  let size = minimumSize + 1
  let next = end + 1
  let previous = -1
  let buffer = 0
  let bits = 0
  let written = 0
  for (const byte of data) {
    buffer |= byte << bits
    bits += 8
    while (bits >= size) {
      const code = buffer & ((1 << size) - 1)
      buffer >>>= size
      bits -= size

      if (code === clear) {
        size = minimumSize + 1
        next = end + 1
        previous = -1
        continue
      }
      if (code === end) return out

      if (previous !== -1 && next < 4096) {
        prefix[next] = previous
        suffix[next] = code === next ? first[previous]! : first[code]!
        first[next] = first[previous]!
        length[next] = length[previous]! + 1
        next++
        if (next === 1 << size && size < 12) size++
      }

      let entry = code
      for (let i = written + length[code]! - 1; i >= written; i--) {
        if (i < count) out[i] = suffix[entry]!
        entry = prefix[entry]!
      }
      written += length[code]!
      previous = code
    }
  }
  return out
}

function interlacedRows(height: number): number[] {
  const rows: number[] = []
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]] as const) {
    for (let y = start; y < height; y += step) rows.push(y)
  }
  return rows
}

function paletteSize(flags: number): number {
  return 3 << ((flags & 7) + 1)
}

function joinBlocks(bytes: Uint8Array, at: number): Uint8Array {
  const blocks: Uint8Array[] = []
  for (let size = bytes[at]!; size; size = bytes[at]!) {
    blocks.push(bytes.subarray(at + 1, at + 1 + size))
    at += size + 1
  }
  const data = new Uint8Array(blocks.reduce((total, block) => total + block.length, 0))
  let offset = 0
  for (const block of blocks) {
    data.set(block, offset)
    offset += block.length
  }
  return data
}

function skipBlocks(bytes: Uint8Array, at: number): number {
  while (bytes[at]) at += bytes[at]! + 1
  return at + 1
}

function u16(bytes: Uint8Array, at: number): number {
  return bytes[at]! | bytes[at + 1]! << 8
}
