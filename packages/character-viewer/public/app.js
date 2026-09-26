// character-viewer's page. The server hands over the whole cast as one
// manifest, so this is a plain read of what is on disk: the cast on the left,
// the selected maid on the right, and a health report saying what a consumer
// would trip over.

const state = {
  cast: null,
  slug: '',
  view: 'artwork',
  lang: '',
  variant: '',
  source: false,
  set: 'portrait',
  pick: 'neutral',
}

const SEVERITIES = ['error', 'warn', 'info']
const PLURALS = { error: 'errors', warn: 'warnings', info: 'notes' }
const VIEWS = ['artwork', 'persona', 'health']

/** How wide a picture is shown. The height is never set, so it always follows
 *  the picture's own proportion and nothing is ever stretched.
 *
 *  The artwork ships at @2, so a portrait is shown at half its pixel width — a
 *  960×1280 portrait is a 480×640 picture and a 512×1280 one is 256×640. A
 *  36×48 sprite has no useful logical size, so it gets a width of its own: 360
 *  is ten times its 36 columns, which lands every cell on a whole square. */
const RETINA = 2
const PIXEL_WIDTH = 360

const widthOf = (picture, kind) => kind === 'pixel' ? PIXEL_WIDTH : picture.width / RETINA

const header = document.querySelector('header')
const castList = document.querySelector('#cast')
const detail = document.querySelector('#detail')

boot()

async function boot() {
  try {
    state.cast = await fetch('/api/cast').then((response) => response.json())
  } catch (error) {
    // Without this the page is a dark rectangle with no way to tell a dead
    // server from a slow one.
    document.querySelector('#detail').innerHTML = `<p class="none">Could not read the cast from the server: ${esc(error.message)}</p>`
    return
  }
  state.slug = state.cast.characters[0]?.slug ?? ''
  castList.addEventListener('click', onCastClick)
  detail.addEventListener('click', onDetailClick)
  document.addEventListener('keydown', onKey)
  render()
}

function render() {
  const character = current()
  if (!character) {
    detail.innerHTML = '<p class="none">No folder in the cast holds a persona file.</p>'
    return
  }
  renderHeader()
  castList.innerHTML = state.cast.characters.map(maidRow).join('')
  detail.innerHTML = [identity(character), tabs(character), viewOf(character)].join('')
  // The rail is a long scroll and the keyboard walks it, so it has to follow
  // along rather than leaving the chosen face off in the scroll.
  detail.querySelector('.thumb.is-active')?.scrollIntoView({ block: 'nearest' })
}

/* the cast, at a glance */

function renderHeader() {
  const counts = countBy(state.cast.findings, (finding) => finding.severity)
  header.querySelector('#path').textContent = state.cast.dir
  header.querySelector('#tally').textContent = [
    `${state.cast.characters.length} maids`,
    `${state.cast.matrix.length} expressions`,
    ...SEVERITIES.map((severity) => `${counts[severity] ?? 0} ${PLURALS[severity]}`),
  ].join(' · ')
}

function maidRow(character) {
  const fields = fieldsOf(character)
  const art = identityArt(character)
  return `<button class="maid ${character.slug === state.slug ? 'is-active' : ''}" data-slug="${character.slug}">
    ${art ? `<img src="/asset/${character.slug}/${art.route}" alt="">` : '<span class="blank"></span>'}
    <span class="name">${esc(fields.name ?? character.slug)}</span>
    <span class="meta">${character.slug} · ${fields.version ? `v${esc(fields.version)}` : 'no version'}</span>
    <span class="art">${character.artwork.portraits.length} portraits · ${character.artwork.pixels.length} pixels</span>
    <span class="dot dot-${worstByCharacter()[character.slug] ?? 'ok'}"></span>
  </button>`
}

function identity(character) {
  const fields = fieldsOf(character)
  const art = identityArt(character)
  const rows = [
    ['id', fields.id],
    ['version', fields.version],
    ['author', fields.author],
    ['extends', fields.extends],
    ['outfits', fields.outfits && Object.entries(fields.outfits).map(([key, value]) => `${key}: ${value}`).join(', ')],
  ].filter(([, value]) => value)
  return `<div class="identity">
    ${art ? `<img src="/asset/${character.slug}/${art.route}" alt="">` : ''}
    <div>
      <h2>${esc(fields.name ?? character.slug)}</h2>
      <p class="sub">${esc(fields.description ?? '')}</p>
      ${fields.quote ? `<p class="sub">“${esc(fields.quote)}”</p>` : ''}
      <dl class="fields">${rows.map(([key, value]) => `<dt>${key}</dt><dd>${esc(value)}</dd>`).join('')}</dl>
    </div>
  </div>`
}

function tabs(character) {
  const notes = state.cast.findings.filter((finding) => finding.slug === character.slug).length
  return `<div class="tabs">${VIEWS.map((view) =>
    `<button data-view="${view}" class="${state.view === view ? 'is-active' : ''}">${view}${view === 'health' && notes ? ` <span class="count">${notes}</span>` : ''}</button>`,
  ).join('')}</div>`
}

function viewOf(character) {
  if (state.view === 'persona') return personaView(character)
  if (state.view === 'health') return healthView(character)
  return artworkView(character)
}

/* artwork: what she actually ships, with the faces she does not have as holes */

function artworkView(character) {
  const artwork = currentArtwork()
  return `
    ${variantBar(character)}
    <h3>Identity <small>avatar.webp</small></h3>
    ${artwork.avatar
      ? `<div class="pictures"><img src="/asset/${character.slug}/${artwork.avatar.route}" alt=""><div class="meta">${size(artwork.avatar)} · ${filesize(artwork.avatar.bytes)}</div></div>`
      : '<p class="none">No avatar.webp, so the desktop app falls back to the neutral portrait.</p>'}
    <div class="tabs">${artSets().map((set) =>
      `<button data-set="${set.id}" class="${state.set === set.id ? 'is-active' : ''}">${set.label} <span class="count">${set.pictures.length}</span></button>`,
    ).join('')}</div>
    ${currentSet().length
      ? `${viewer(character)}<p class="keys">↑ ↓ ← → flip through faces · [ ] change maid</p>`
      : `<p class="none">${emptyNote()}</p>`}
  `
}

/** Thumbnails down the left, the chosen one blown up on the right. */
function viewer(character) {
  const shown = selected()
  const width = widthOf(shown, state.set)
  return `<div class="viewer" data-kind="${state.set}">
    <div class="rail">${rail(character)}</div>
    <div class="stage">
      <img class="${state.set}" style="width:${width}px" src="/asset/${character.slug}/${shown.route}" alt="${shown.id}">
      <p class="caption">${esc(shown.id)} ${esc(kaomoji(shown.id))} · ${size(shown)} shown at ${width}×${Math.round(width * shown.height / shown.width)} · ${filesize(shown.bytes)}${shown.animated ? ` · ${shown.frames} frames` : ''} · ${shown.route}</p>
    </div>
  </div>`
}

function variantBar(character) {
  if (!character.variants.length) return ''
  const options = [{ id: '', label: 'default' }, ...character.variants.map((variant) => ({ id: variant.id, label: variant.id }))]
  return `<div class="tabs variants">${options.map((option) =>
    `<button data-variant="${option.id}" class="${state.variant === option.id ? 'is-active' : ''}">${option.label}</button>`,
  ).join('')}</div>`
}

/** Every expression the mood marker can name, in the order the prompt lists
 *  them, so a missing face reads as a hole rather than an absence. */
function rail(character) {
  const drawn = new Map(currentSet().map((picture) => [picture.id, picture]))
  const shown = selected()
  return state.cast.matrix.map((row) => drawn.has(row.expression)
    ? thumb(character, drawn.get(row.expression), shown.id)
    : `<div class="hole">${row.expression}</div>`,
  ).join('')
}

function thumb(character, picture, shown) {
  return `<button class="thumb ${picture.id === shown ? 'is-active' : ''}" data-pick="${picture.id}">
    <img src="/asset/${character.slug}/${picture.route}" alt="" loading="lazy">
    <span class="name">${picture.id}</span>
    <span class="kaomoji">${esc(kaomoji(picture.id))}</span>
  </button>`
}

/* persona: the file as written, and the file as read */

function personaView(character) {
  const languages = Object.keys(character.personas)
  state.lang = languages.includes(state.lang) ? state.lang : languages[0]
  const persona = character.personas[state.lang]
  return `
    <div class="tabs">
      ${languages.map((language) => `<button data-lang="${language}" class="${language === state.lang ? 'is-active' : ''}">${language}</button>`).join('')}
      <button data-source class="${state.source ? 'is-active' : ''}">Source</button>
    </div>
    ${state.source
      ? `<p class="sub">${character.slug}/${persona.file}</p><pre class="source">${esc(persona.raw)}</pre>`
      : `<article class="persona">${markdown(persona.body)}</article>`}`
}

/* health: what a consumer would trip on, and where the cast is uneven */

function healthView(character) {
  const mine = state.cast.findings.filter((finding) => finding.slug === character.slug)
  const others = state.cast.findings.filter((finding) => finding.slug !== character.slug)
  return `
    <h3>This maid</h3>
    ${findings(mine)}
    <h3>Expression coverage <small>portrait · pixel</small></h3>
    ${matrix()}
    ${others.length ? `<details><summary>${others.length} other findings in the cast</summary>${findings(others)}</details>` : ''}`
}

function findings(list) {
  if (!list.length) return '<p class="none">Nothing to flag.</p>'
  return `<div class="findings">${SEVERITIES.flatMap((severity) =>
    list.filter((finding) => finding.severity === severity).map((finding) =>
      `<div class="finding ${severity}"><code>${finding.code}</code><span>${esc(finding.message)}</span></div>`,
    ),
  ).join('')}</div>`
}

function matrix() {
  const slugs = state.cast.characters.map((character) => character.slug)
  const cell = (drawn) => drawn === null ? '<td class="na">·</td>' : `<td class="${drawn ? 'yes' : 'no'}">${drawn ? '●' : '○'}</td>`
  return `<table class="matrix">
    <thead>
      <tr><th></th>${slugs.map((slug) => `<th colspan="2">${slug}</th>`).join('')}</tr>
      <tr><th></th>${slugs.map(() => '<th class="subhead">portrait</th><th class="subhead">pixel</th>').join('')}</tr>
    </thead>
    <tbody>${state.cast.matrix.map((row) =>
      `<tr><th>${row.expression} <span class="kaomoji">${esc(row.kaomoji)}</span></th>${row.cells.map((entry) => cell(entry.portraits) + cell(entry.pixels)).join('')}</tr>`,
    ).join('')}</tbody>
  </table>`
}

/* what the page does about you */

function onCastClick(event) {
  const slug = event.target.closest?.('[data-slug]')?.dataset.slug
  if (!slug) return
  state.slug = slug
  state.variant = ''
  render()
}

function onDetailClick(event) {
  const hit = event.target.closest?.('[data-view], [data-variant], [data-set], [data-pick], [data-lang], [data-source]')
  if (!hit) return
  const data = hit.dataset
  if (data.view) state.view = data.view
  else if (data.variant !== undefined) { state.variant = data.variant; state.view = 'artwork' }
  else if (data.set) state.set = data.set
  else if (data.pick) state.pick = data.pick
  else if (data.lang) state.lang = data.lang
  else if ('source' in data) state.source = !state.source
  render()
}

const FACE_KEYS = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }
const MAID_KEYS = { '[': -1, ']': 1 }

function onKey(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  // Every arrow moves to the next face, and the default scroll is suppressed:
  // without that the page scrolled under the picture on every keypress, and the
  // rail is a grid, so left and right would otherwise be the two directions that
  // did nothing.
  if (event.key in FACE_KEYS) {
    event.preventDefault()
    return step(FACE_KEYS[event.key])
  }
  if (event.key in MAID_KEYS) {
    event.preventDefault()
    return hopMaid(MAID_KEYS[event.key])
  }
}

/** Walk the rail, in the order the mood marker's table lists the expressions. */
function step(by) {
  const drawn = new Set(currentSet().map((picture) => picture.id))
  const order = state.cast.matrix.map((row) => row.expression).filter((id) => drawn.has(id))
  if (!order.length) return
  const at = order.indexOf(selected().id)
  state.pick = order[(at + by + order.length) % order.length]
  render()
}

function hopMaid(by) {
  const slugs = state.cast.characters.map((character) => character.slug)
  state.slug = slugs[(slugs.indexOf(state.slug) + by + slugs.length) % slugs.length]
  render()
}

/* looking things up */

const current = () => state.cast.characters.find((character) => character.slug === state.slug)
const fieldsOf = (character) => character.personas.en?.fields ?? Object.values(character.personas)[0]?.fields ?? {}
const identityArt = (character) => character.artwork.avatar ?? character.artwork.portraits.find((portrait) => portrait.id === 'neutral')
const currentArtwork = () => current().variants.find((variant) => variant.id === state.variant)?.artwork ?? current().artwork

/** The two artwork sets, as the rail's switcher. */
const artSets = () => {
  const artwork = currentArtwork()
  const animated = artwork.pixels.filter((pixel) => pixel.animated).length
  return [
    { id: 'portrait', label: 'Portraits', pictures: artwork.portraits, note: uniqueSizes(artwork.portraits) },
    { id: 'pixel', label: 'Pixels', pictures: artwork.pixels, note: artwork.pixels.length ? `${uniqueSizes(artwork.pixels)}${animated ? ` · ${animated} animated` : ''}` : '' },
  ]
}

const currentSet = () => artSets().find((set) => set.id === state.set)?.pictures ?? []

/** The expression the big picture is showing. Holding the name rather than a
 *  position is what lets the rail and the stage agree, and lets switching sets
 *  keep her on the same face. */
const selected = () => currentSet().find((picture) => picture.id === state.pick) ?? currentSet()[0]

const emptyNote = () => state.set === 'pixel'
  ? 'Nothing in pixels/, so the terminal panel has no face to draw.'
  : 'Nothing in portraits/, so the desktop app will not list her.'

const kaomoji = (expression) => state.cast.matrix.find((row) => row.expression === expression)?.kaomoji ?? ''
const size = (picture) => `${picture.width}×${picture.height}`
const uniqueSizes = (pictures) => [...new Set(pictures.map(size))].join(' / ')

const filesize = (bytes) => bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`

function worstByCharacter() {
  const worst = {}
  for (const finding of state.cast.findings) {
    if (rank(finding.severity) < rank(worst[finding.slug])) worst[finding.slug] = finding.severity
  }
  return worst
}

const rank = (severity) => severity ? SEVERITIES.indexOf(severity) : SEVERITIES.length

function countBy(list, key) {
  const counts = {}
  for (const item of list) counts[key(item)] = (counts[key(item)] ?? 0) + 1
  return counts
}

const esc = (text) => String(text).replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character])

/** The persona bodies use headings, flat lists, paragraphs and inline code, so
 *  this reads exactly that and nothing more. */
function markdown(source) {
  const html = []
  let open = null
  const close = () => {
    if (!open) return
    html.push(`</${open}>`)
    open = null
  }
  for (const line of source.split(/\r?\n/)) {
    const text = line.trim()
    if (!text) { close(); continue }
    const heading = /^(#{1,3})\s+(.*)$/.exec(text)
    const bullet = /^[-*]\s+(.*)$/.exec(text)
    if (heading) {
      close()
      const level = heading[1].length
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`)
    } else if (bullet) {
      if (open !== 'ul') { close(); open = 'ul'; html.push('<ul>') }
      html.push(`<li>${inline(bullet[1])}</li>`)
    } else {
      if (open === 'ul') close()
      html.push(`<p>${inline(text)}</p>`)
    }
  }
  close()
  return html.join('\n')
}

const inline = (text) => esc(text)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
