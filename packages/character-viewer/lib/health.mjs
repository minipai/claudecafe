const REQUIRED = ['format_version', 'id', 'name', 'version', 'author', 'description']
const PIXEL_SIZE = { width: 36, height: 48 }

/**
 * What a consumer of the cast would trip over, read off the folder as it
 * stands: the metadata contract every persona declares, the artwork the desktop
 * and the terminal panel refuse to work without, and the places where one maid
 * has drifted away from another.
 */
export function checkCast(cast, vocabulary) {
  const findings = []
  const report = (severity, slug, code, message) => findings.push({ severity, slug, code, message })

  const shared = {
    vocabulary: vocabulary?.map((entry) => entry.expression) ?? null,
    avatarSize: mostCommon(cast.characters.map((character) => sizeOf(character.artwork.avatar))),
    portraitSize: mostCommon(cast.characters.flatMap((character) => character.artwork.portraits.map(sizeOf))),
  }

  for (const character of cast.characters) {
    checkPersonas(character, report)
    checkArtwork(character, shared, report)
  }
  for (const stray of cast.strays) {
    if (!stray.artwork.length) continue
    report('error', stray.slug, 'folder.no-persona', `${stray.slug} holds ${stray.artwork.join(', ')} but no persona file, so the café never sees her.`)
  }

  return { findings, matrix: buildMatrix(cast, vocabulary), cast: shared }
}

function checkPersonas(character, report) {
  for (const persona of Object.values(character.personas)) {
    const where = `${character.slug}/${persona.file}`
    if (!persona.ok) {
      report('error', character.slug, 'persona.frontmatter', `${where} has no closed metadata block.`)
      continue
    }
    const missing = REQUIRED.filter((key) => !persona.fields[key])
    if (missing.length) report('error', character.slug, 'persona.field', `${where} is missing ${missing.join(', ')}.`)

    const expected = `claudecafe/${character.slug}`
    if (persona.fields.id && persona.fields.id !== expected) {
      report('error', character.slug, 'persona.id', `${where} declares id ${persona.fields.id}, but its folder is ${character.slug} — expected ${expected}.`)
    }
    if (persona.fields.version && !/^\d+\.\d+\.\d+$/.test(persona.fields.version)) {
      report('error', character.slug, 'persona.version', `${where} is version ${persona.fields.version}, which is not x.y.z.`)
    }
  }

  // The release tag is taken from every persona*.md in the folder, so a maid
  // whose translations disagree would ship under a version nobody wrote.
  const versions = new Set(Object.values(character.personas).map((persona) => persona.fields.version).filter(Boolean))
  if (versions.size > 1) {
    report('error', character.slug, 'persona.version-mismatch', `${character.slug} persona files disagree on the version: ${[...versions].join(' vs ')}.`)
  }
}

function checkArtwork(character, shared, report) {
  const { artwork, slug } = character

  // The desktop app skips a maid without this, and the release shipper refuses
  // the pack — the one missing file that takes a character out of the café.
  if (!artwork.portraits.some((portrait) => portrait.id === 'neutral')) {
    report('error', slug, 'art.neutral', `${slug} has no portraits/neutral.webp, so the desktop app will not list her.`)
  }
  for (const variant of character.variants) {
    if (!variant.artwork.portraits.some((portrait) => portrait.id === 'neutral')) {
      report('error', slug, 'art.variant-neutral', `${slug}/variants/${variant.id} has no portraits/neutral.webp.`)
    }
  }

  if (!artwork.avatar) {
    report('warn', slug, 'art.avatar', `${slug} has no avatar.webp; the desktop app falls back to the neutral portrait.`)
  } else if (shared.avatarSize && sizeOf(artwork.avatar) !== shared.avatarSize) {
    report('info', slug, 'art.avatar-size', `${slug} avatar.webp is ${sizeOf(artwork.avatar)}; the rest of the cast is ${shared.avatarSize}.`)
  }

  if (!artwork.pixels.length) {
    report('info', slug, 'art.pixels', `${slug} ships no pixels/, so the terminal panel has nothing to draw.`)
  } else {
    const odd = artwork.pixels.filter((pixel) => pixel.width !== PIXEL_SIZE.width || pixel.height !== PIXEL_SIZE.height)
    if (odd.length) {
      report('warn', slug, 'art.pixel-size', `${odd.length} of ${slug} pixels are not ${PIXEL_SIZE.width}×${PIXEL_SIZE.height}: ${[...new Set(odd.map(sizeOf))].join(', ')}.`)
    }
  }

  const portraitSizes = new Set(artwork.portraits.filter((portrait) => sizeOf(portrait) !== shared.portraitSize).map(sizeOf))
  if (portraitSizes.size) {
    report('info', slug, 'art.portrait-size', `${slug} portraits are ${[...portraitSizes].join(', ')}; the rest of the cast is ${shared.portraitSize}.`)
  }
  for (const file of artwork.unshippable) {
    report('warn', slug, 'art.unshippable', `${slug} has ${file}, which the release archives do not match.`)
  }

  // The two art sets are drawn side by side in the panel, so a face that is
  // missing from one of them shows up as a hole in the other.
  const portraits = new Set(artwork.portraits.map((portrait) => portrait.id))
  const pixels = new Set(artwork.pixels.map((pixel) => pixel.id))
  if (pixels.size) {
    for (const id of portraits) if (!pixels.has(id)) {
      report('warn', slug, 'art.set-mismatch', `${slug} draws ${id} as a portrait but not as a pixel sprite.`)
    }
    for (const id of pixels) if (!portraits.has(id)) {
      report('warn', slug, 'art.set-mismatch', `${slug} draws ${id} as a pixel sprite but not as a portrait.`)
    }
  }

  if (shared.vocabulary) {
    const drawn = new Set([...portraits, ...pixels])
    const missing = shared.vocabulary.filter((expression) => !drawn.has(expression))
    if (missing.length) {
      report('info', slug, 'art.coverage', `${slug} is missing ${missing.length} of ${shared.vocabulary.length} expressions: ${missing.join(', ')}.`)
    }
    for (const id of drawn) if (!shared.vocabulary.includes(id)) {
      report('warn', slug, 'art.unknown-expression', `${slug} draws ${id}, which no mood marker can select.`)
    }
  }
}

/** Every expression against every maid, so a missing face is a hole you can see. */
function buildMatrix(cast, vocabulary) {
  const drawn = new Set()
  for (const character of cast.characters) {
    for (const artwork of [character.artwork, ...character.variants.map((variant) => variant.artwork)]) {
      for (const picture of [...artwork.portraits, ...artwork.pixels]) drawn.add(picture.id)
    }
  }
  const known = new Set(vocabulary?.map((entry) => entry.expression) ?? [])
  const ordered = [
    ...[...known],
    ...[...drawn].filter((id) => !known.has(id)).sort(),
  ]
  return ordered.map((expression) => ({
    expression,
    kaomoji: vocabulary?.find((entry) => entry.expression === expression)?.kaomoji ?? '',
    cells: cast.characters.map((character) => ({
      slug: character.slug,
      portraits: character.artwork.portraits.some((portrait) => portrait.id === expression),
      pixels: character.artwork.pixels.length
        ? character.artwork.pixels.some((pixel) => pixel.id === expression)
        : null,
    })),
  }))
}

const sizeOf = (picture) => picture ? `${picture.width}×${picture.height}` : null

/** The measurement the rest of the cast agrees on, so an odd one stands out. */
function mostCommon(sizes) {
  const tally = new Map()
  for (const size of sizes.filter(Boolean)) tally.set(size, (tally.get(size) ?? 0) + 1)
  return [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}
