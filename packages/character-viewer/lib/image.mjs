import fs from 'node:fs'

/**
 * The only facts character-viewer claims about a picture: how big it is on disk, how
 * many pixels it paints, and whether a GIF moves. Both formats answer from the
 * file header, so a whole cast of portraits is read without decoding a pixel.
 */
export function probeArt(file) {
  const buffer = fs.readFileSync(file)
  const gif = gifProbe(buffer)
  if (gif) return { bytes: buffer.length, ...gif }
  return { bytes: buffer.length, ...webpProbe(buffer) }
}

function webpProbe(buffer) {
  if (buffer.slice(0, 4).toString() !== 'RIFF' || buffer.slice(8, 12).toString() !== 'WEBP') return { format: 'unknown' }
  const chunk = buffer.slice(12, 16).toString()
  // VP8 and VP8L each keep the size in a fixed spot; VP8X spreads it over 24-bit
  // fields and subtracts one, because zero would be an empty picture.
  if (chunk === 'VP8 ') {
    return { format: 'webp', width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff, frames: 1 }
  }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21)
    return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, frames: 1 }
  }
  if (chunk === 'VP8X') {
    return { format: 'webp', width: (buffer.readUIntLE(24, 3) & 0xffffff) + 1, height: (buffer.readUIntLE(27, 3) & 0xffffff) + 1, frames: 1 }
  }
  return { format: 'webp' }
}

function gifProbe(buffer) {
  if (!/^GIF8[79]a$/.test(buffer.slice(0, 6).toString())) return null
  // Every frame is introduced by a graphic control extension, so counting those
  // counts the frames without walking the compressed data between them.
  const bytes = buffer.slice(0, buffer.length - 1)
  let frames = 0
  for (let at = bytes.indexOf(0x21); at !== -1; at = bytes.indexOf(0x21, at + 1)) {
    if (bytes[at + 1] === 0xf9) frames++
  }
  return {
    format: 'gif',
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
    frames: Math.max(frames, 1),
    animated: frames > 1,
  }
}
