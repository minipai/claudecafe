import fs from 'node:fs'
import path from 'node:path'
import { parseFrontmatter, personaBody } from './frontmatter.mjs'
import { probeArt } from './image.mjs'

/**
 * character-viewer's picture of the cast: every folder that holds a persona, with the
 * artwork it actually ships, read fresh off disk each time. A folder without a
 * persona is nobody, so it is reported apart from the cast rather than dropped
 * into it.
 */
export function readCast(dir) {
  const characters = []
  const strays = []
  for (const slug of foldersOf(dir)) {
    const folder = path.join(dir, slug)
    const personaFiles = filesOf(folder).filter(isPersona).sort()
    if (!personaFiles.length) {
      strays.push({ slug, artwork: artworkIn(folder) })
      continue
    }
    characters.push(readCharacter(slug, folder, personaFiles))
  }
  return { dir, characters, strays }
}

function readCharacter(slug, folder, personaFiles) {
  const personas = {}
  for (const file of personaFiles) {
    const raw = fs.readFileSync(path.join(folder, file), 'utf8')
    const { ok, fields, raw: head } = parseFrontmatter(raw)
    personas[languageOf(file)] = { file, head, ok, fields, body: personaBody(raw), raw }
  }
  return { slug, personas, artwork: readArtwork(folder, ''), variants: readVariants(folder) }
}

/** `persona.md` is the default persona; `persona.<lang>.md` is a variant of it. */
const languageOf = (file) => /^persona(?:\.([\w-]+))?\.md$/.exec(file)?.[1] ?? 'en'

/** The drawing scripts and the release archives are meant to sit beside the
 *  cast, so what makes a folder interesting is artwork: a folder holding art
 *  but no persona is a maid who lost her file, not a working folder. */
function artworkIn(folder) {
  return ['avatar.webp', 'portraits', 'pixels'].filter((name) => fs.existsSync(path.join(folder, name)))
}

/** A character root is a complete default variant, and each folder under
 *  `variants/` is a complete alternative for the same persona. */
function readArtwork(folder, prefix) {
  const avatar = path.join(folder, 'avatar.webp')
  return {
    avatar: fs.existsSync(avatar) ? picture(avatar, `${prefix}avatar.webp`) : null,
    portraits: picturesIn(path.join(folder, 'portraits'), '.webp', prefix),
    pixels: picturesIn(path.join(folder, 'pixels'), '.gif', prefix),
    unshippable: [...unshippable(path.join(folder, 'portraits'), '.webp'), ...unshippable(path.join(folder, 'pixels'), '.gif')],
  }
}

function readVariants(folder) {
  const root = path.join(folder, 'variants')
  if (!fs.existsSync(root)) return []
  return foldersOf(root).map((id) => {
    const dir = path.join(root, id)
    const persona = filesOf(dir).find(isPersona) ?? null
    const fields = persona ? parseFrontmatter(fs.readFileSync(path.join(dir, persona), 'utf8')).fields : {}
    return { id, file: persona, extends: fields.extends ?? '', artwork: readArtwork(dir, `variants/${id}/`) }
  })
}

function picturesIn(dir, extension, prefix) {
  if (!fs.existsSync(dir)) return []
  return filesOf(dir)
    .filter((file) => file.endsWith(extension))
    .sort()
    .map((file) => picture(path.join(dir, file), `${prefix}${path.basename(dir)}/${file}`))
}

/** Anything in an artwork folder the release archives would not pick up. */
function unshippable(dir, extension) {
  if (!fs.existsSync(dir)) return []
  return filesOf(dir)
    .filter((file) => !file.endsWith(extension))
    .map((file) => `${path.basename(dir)}/${file}`)
}

function picture(file, route) {
  return { route, id: path.basename(file).replace(/\.[^.]+$/, ''), ...probeArt(file) }
}

const isPersona = (file) => /^persona(\.[\w-]+)?\.md$/.test(file)
const foldersOf = (dir) => fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  : []
const filesOf = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => fs.statSync(path.join(dir, file)).isFile()) : []
