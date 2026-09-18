/**
 * gunzip, because a hooks module has no `DecompressionStream`.
 *
 * Its globals are the ones `claude-code.d.ts` declares — URL, TextDecoder,
 * atob, crypto — and no stream codecs, so the faces file's gzip is unpacked
 * here: RFC 1952's header, then RFC 1951's blocks, stored, fixed and dynamic.
 */
export function gunzip(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 8) throw new Error('Not gzip')
  const flags = bytes[3]!
  let at = 10
  if (flags & 4) at += 2 + (bytes[at]! | bytes[at + 1]! << 8)
  if (flags & 8) while (bytes[at++]) { /* file name */ }
  if (flags & 16) while (bytes[at++]) { /* comment */ }
  if (flags & 2) at += 2
  return inflate(bytes, at, new DataView(bytes.buffer, bytes.byteOffset).getUint32(bytes.length - 4, true))
}

function inflate(bytes: Uint8Array, at: number, size: number): Uint8Array {
  const out = new Uint8Array(size)
  const bits = reader(bytes, at)
  let written = 0
  for (;;) {
    const last = bits.take(1)
    const kind = bits.take(2)
    if (kind === 0) written = stored(bits, out, written)
    else if (kind === 1) written = block(bits, out, written, FIXED_LITERALS, FIXED_DISTANCES)
    else if (kind === 2) {
      const [literals, distances] = tables(bits)
      written = block(bits, out, written, literals, distances)
    } else throw new Error('Bad deflate block')
    if (last) return out
  }
}

/** An uncompressed block: byte-aligned, its length up front. */
function stored(bits: Bits, out: Uint8Array, written: number): number {
  const length = bits.bytes()
  for (let i = 0; i < length; i++) out[written++] = bits.take(8)
  return written
}

/** A compressed block: literals, and lengths paired with a distance back. */
function block(bits: Bits, out: Uint8Array, written: number, literals: Huffman, distances: Huffman): number {
  for (;;) {
    const symbol = decode(bits, literals)
    if (symbol < 256) {
      out[written++] = symbol
    } else if (symbol === 256) {
      return written
    } else {
      const index = symbol - 257
      const length = LENGTHS[index]! + bits.take(LENGTH_BITS[index]!)
      const far = decode(bits, distances)
      let from = written - (DISTANCES[far]! + bits.take(DISTANCE_BITS[far]!))
      for (let i = 0; i < length; i++) out[written++] = out[from++]!
    }
  }
}

/** A dynamic block's own two code tables, themselves coded. */
function tables(bits: Bits): [Huffman, Huffman] {
  const literalCount = bits.take(5) + 257
  const distanceCount = bits.take(5) + 1
  const codeCount = bits.take(4) + 4

  const codeLengths = new Uint8Array(19)
  for (let i = 0; i < codeCount; i++) codeLengths[CODE_ORDER[i]!] = bits.take(3)
  const codes = huffman(codeLengths)

  const lengths = new Uint8Array(literalCount + distanceCount)
  for (let i = 0; i < lengths.length;) {
    const symbol = decode(bits, codes)
    if (symbol < 16) {
      lengths[i++] = symbol
    } else if (symbol === 16) {
      const previous = lengths[i - 1]!
      for (let n = bits.take(2) + 3; n > 0; n--) lengths[i++] = previous
    } else if (symbol === 17) {
      i += bits.take(3) + 3
    } else {
      i += bits.take(7) + 11
    }
  }
  return [huffman(lengths.subarray(0, literalCount)), huffman(lengths.subarray(literalCount))]
}

// --- canonical Huffman ---------------------------------------------------------

type Huffman = { counts: Uint16Array; symbols: Uint16Array }

/** Code lengths in, the canonical code they describe out. */
function huffman(lengths: Uint8Array): Huffman {
  const counts = new Uint16Array(16)
  for (const length of lengths) counts[length]!++
  counts[0] = 0

  const offsets = new Uint16Array(16)
  for (let length = 1; length < 16; length++) offsets[length + 1] = offsets[length]! + counts[length]!
  const symbols = new Uint16Array(lengths.length)
  for (let symbol = 0; symbol < lengths.length; symbol++) {
    if (lengths[symbol]) symbols[offsets[lengths[symbol]!]!++] = symbol
  }
  return { counts, symbols }
}

/** Walk the code bit by bit until the value falls inside a length's range. */
function decode(bits: Bits, { counts, symbols }: Huffman): number {
  let code = 0
  let first = 0
  let index = 0
  for (let length = 1; length < 16; length++) {
    code |= bits.take(1)
    const count = counts[length]!
    if (code - first < count) return symbols[index + (code - first)]!
    index += count
    first = (first + count) << 1
    code <<= 1
  }
  throw new Error('Bad Huffman code')
}

// --- the bit reader ------------------------------------------------------------

type Bits = ReturnType<typeof reader>

function reader(bytes: Uint8Array, at: number) {
  let hold = 0
  let count = 0
  return {
    /** The next `want` bits, least significant first. */
    take(want: number): number {
      while (count < want) {
        hold |= bytes[at++]! << count
        count += 8
      }
      const value = hold & ((1 << want) - 1)
      hold >>>= want
      count -= want
      return value
    },
    /** Drops to the next byte and reads a stored block's length and its check. */
    bytes(): number {
      hold = 0
      count = 0
      const length = bytes[at]! | bytes[at + 1]! << 8
      at += 4
      return length
    },
  }
}

// --- RFC 1951's constants ------------------------------------------------------

const LENGTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LENGTH_BITS = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const DISTANCES = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const DISTANCE_BITS = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
const CODE_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

const FIXED_LITERALS = huffman(Uint8Array.from({ length: 288 }, (_, symbol) =>
  symbol < 144 ? 8 : symbol < 256 ? 9 : symbol < 280 ? 7 : 8))
const FIXED_DISTANCES = huffman(new Uint8Array(30).fill(5))
