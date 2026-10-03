// The desktop's drawings. The desktop draws no Image or Raster, so every picture is an SVG string, a WebP riding
// inside it as a data URI; one SVG holds at most 131072 characters, about 98 KB of WebP.

/** Her avatar's side, in pixels. */
export const AVATAR = 72
/** Her name's colour over a reply and the line round her thought box. */
export const ROSE = '#d9708f'
/** Pixels between her name and the reply under it. */
export const NAME_GAP = 5
export const NAME_TAG_HEIGHT = 24
export const THOUGHT_INK = '#5d4650'
export const PANE_WASH = '#f8eeee'
export const CUT_IN_MS = 2400

/** The pack's `portraits-540/` pictures. */
const PORTRAIT = { width: 540, height: 720 }
/** Rough pixels a row and a column on the desktop, for shapes that must match the pane. */
const ROW_PIXELS = 19
const COLUMN_PIXELS = 8.4
const PETAL_COUNT = 10
const petalFields = new Map()

/** Her face in a rounded square: it has no background of its own, so a soft wash sits behind it and a gold line closes it. */
export function avatarSvg(webp) {
  const radius = 16
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${AVATAR}" height="${AVATAR}" viewBox="0 0 ${AVATAR} ${AVATAR}" preserveAspectRatio="xMidYMin meet">`
    + `<clipPath id="round"><rect width="${AVATAR}" height="${AVATAR}" rx="${radius}"/></clipPath>`
    + '<linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e3e8"/><stop offset="1" stop-color="#fbf1e4"/></linearGradient>'
    + `<rect width="${AVATAR}" height="${AVATAR}" rx="${radius}" fill="url(#wash)"/>`
    + `<image width="${AVATAR}" height="${AVATAR}" clip-path="url(#round)" href="data:image/webp;base64,${webp}"/>`
    + `<rect x="0.5" y="0.5" width="${AVATAR - 1}" height="${AVATAR - 1}" rx="${radius - 0.5}" fill="none" stroke="#c9a45c" stroke-width="1"/>`
    + '</svg>'
}

/** Her whole portrait, marked up at twice its size so that, unsized, it fills whatever stage it is given. */
export function portraitSvg(webp) {
  const { width, height } = PORTRAIT
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}">`
    + `<image width="${width}" height="${height}" href="data:image/webp;base64,${webp}"/>`
    + '</svg>'
}

/**
 * A fighting-game cut-in: a slanted band sweeps in, her half-body (head to waist, cut out of the portrait by a
 * nested view box) slides across it, holds, and both leave. Everything ends off the canvas, and the hook stops
 * drawing it when the clock runs out.
 */
export function cutInSvg({ picture, shout }) {
  const sweep = (values) => `<animateTransform attributeName="transform" type="translate" values="${values}" keyTimes="0;0.16;0.84;1" dur="${CUT_IN_MS}ms" calcMode="spline" keySplines="0.2 0.9 0.3 1;0 0 1 1;0.7 0 0.8 0.1" fill="freeze"/>`
  return '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="260" viewBox="0 0 720 260">'
    + `<g><polygon points="70,20 720,20 650,240 0,240" fill="#b8323a"/><polygon points="64,206 652,206 646,226 58,226" fill="#f4d9a0"/>${sweep('900 0;0 0;-30 0;-900 0')}</g>`
    + `<g><svg x="150" y="-10" width="336" height="420" viewBox="90 0 360 450"><image width="${PORTRAIT.width}" height="${PORTRAIT.height}" href="data:image/webp;base64,${picture}"/></svg>${sweep('-700 0;0 0;40 0;900 0')}</g>`
    + `<g><text x="470" y="150" font-size="44" font-style="italic" font-weight="800" fill="#fff" font-family="system-ui, sans-serif">${escapeXml(shout)}</text>${sweep('900 0;0 0;-20 0;-900 0')}</g>`
    + '</svg>'
}

/** A rose pill carrying the name, as wide as the name needs. */
export function nameTagSvg(text) {
  const width = Math.ceil(textWidth(text) * 13) + 24
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${NAME_TAG_HEIGHT}" viewBox="0 0 ${width} ${NAME_TAG_HEIGHT}">`
    + `<rect width="${width}" height="${NAME_TAG_HEIGHT}" rx="${NAME_TAG_HEIGHT / 2}" fill="${ROSE}"/>`
    + `<text x="12" y="${NAME_TAG_HEIGHT / 2 + 4.5}" font-size="13" font-weight="700" fill="#fff" font-family="system-ui, -apple-system, sans-serif">${escapeXml(text)}</text>`
    + '</svg>'
  return { source, text, width }
}

/**
 * The petal field for a pane of this size, kept per size so a redraw restarts the same petals instead of shuffling.
 * It is laid out twice as wide as the pane, since the pane's columns fall short of its pixels; petals start in the
 * half the pane shows.
 */
export function petalField(rows, columns) {
  const key = `${rows}x${columns}`
  if (!petalFields.has(key)) {
    const width = 540
    const height = Math.round(width * (rows * ROW_PIXELS) / (columns * 2 * COLUMN_PIXELS))
    petalFields.set(key, petalsSvg(PETAL_COUNT, width, height, width / 2))
  }
  return petalFields.get(key)
}

/** A sliver of empty SVG: margins move in whole rows, so a few pixels of air take one of these. */
export function gapSvg(height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="${height}" viewBox="0 0 1 ${height}"/>`
}

/** The avatar's width with no face in it, so the blocks of a reply between her faces keep the indent. */
export function spacerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${AVATAR}" height="1" viewBox="0 0 ${AVATAR} 1"/>`
}

/**
 * Sakura petals drifting down on a slant, as if on a breeze from the right, each turning as it falls and flipping
 * over now and then (a squeeze across its width reads as the petal tumbling).
 */
function petalsSvg(count, width, height, span) {
  // A sakura petal: narrow at the base, rounded, with the small notch at its tip.
  const petal = 'M0 13C-8 7 -9 -4 -3.5 -11L0 -7.5L3.5 -11C9 -4 8 7 0 13Z'
  let petals = ''
  for (let index = 0; index < count; index++) {
    const start = Math.round(span * (0.15 + Math.random() * 1.1))
    const drift = 180 + Math.random() * 160
    const bow = 25 + Math.random() * 35
    const scale = (0.45 + Math.random() * 0.35).toFixed(2)
    const duration = 8 + Math.random() * 6
    const begin = (-Math.random() * duration).toFixed(2)
    const path = `M${start} -24C${start - drift * 0.3 + bow} ${height * 0.35} ${start - drift * 0.7 - bow} ${height * 0.65} ${start - drift} ${height + 24}`
    const spin = Math.random() < 0.5 ? 360 : -360
    petals += `<g><animateMotion path="${path}" dur="${duration.toFixed(2)}s" begin="${begin}s" repeatCount="indefinite"/>`
      + `<path d="${petal}" fill="url(#petal)" transform="scale(${scale})">`
      + `<animateTransform attributeName="transform" type="rotate" from="0" to="${spin}" dur="${(duration * 0.8).toFixed(2)}s" begin="${begin}s" repeatCount="indefinite" additive="sum"/>`
      + `<animateTransform attributeName="transform" type="scale" values="1 1;0.25 1;1 1" dur="${(1.6 + Math.random() * 1.6).toFixed(2)}s" begin="${begin}s" repeatCount="indefinite" additive="sum"/>`
      + '</path></g>'
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}">`
    + '<defs><linearGradient id="petal" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff4f6"/><stop offset="1" stop-color="#f5a9bf"/></linearGradient></defs>'
    + `${petals}</svg>`
}

/** Roughly how many CJK characters wide a line is: a Latin character is about half of one. */
function textWidth(text) {
  return [...text].reduce((width, character) => width + (character.codePointAt(0) > 0x2e7f ? 1 : 0.6), 0)
}

function escapeXml(text) {
  return text.replace(/[<>&"']/g, (character) => `&#${character.charCodeAt(0)};`)
}
