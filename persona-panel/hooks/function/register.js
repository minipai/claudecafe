// packages/character-core/src/expression.ts
function expressionToolDescription(faces) {
  const available = faces.length ? `Available faces: ${faces.join(", ")}. ` : "No GIF faces are installed for this character. ";
  return "Change the visible portrait in the character panel. " + "Choose one available face when your visible expression meaningfully changes, or when the user asks; do not call on every reply or repeat the current state. " + available + "The panel shows only the face; it has no mood field. The selection stays until changed.";
}
function expressionPrompt(toolName = "set_expression") {
  return `The user can see your character standing in a panel beside this terminal conversation. Keep the visible face in step with what you are saying and doing.

- Call ${toolName} with one available face when the visible expression meaningfully changes, without waiting to be asked.
- Change the face before the reply or work it accompanies. Keep it natural: one change for a meaningful shift, not a call on every message or a repeat of the current state. It stays until the next call.
- Choose a face whose filename best fits the visible performance. Use intimate or strongly suggestive faces only when the conversation suits them.
- The tool changes the real panel image.
- Do not narrate routine expression changes. Continue the user's task normally; this panel adds a visible reaction and does not require shorter replies, roleplay, or a different persona.`;
}
var KAOMOJI = {
  neutral: "( • ᴗ • )",
  happy: "＼(ˆ ᗜ ˆ)／",
  curious: "(づ •. •)?",
  thinking: "( ╭ರ_•́ )",
  focused: "(๑•̀ ᴗ•́)૭✧",
  confused: "( ⊙.⊙ )?",
  proud: "ᕙ( •̀ ᗜ •́)ᕗ",
  smug: "( ｀▽´ )",
  excited: "٩(ˊᗜˋ*)و",
  flirty: "( ˘ ³˘)♡",
  smitten: "(,,ᴗ ᴗ,,)♡",
  wink: "☆ ( ＞◡❛)",
  embarrassed: "( ˶>﹏<˶ᵕ)",
  pouty: "( •̀ ε •́ )",
  worried: "(´･ω･｀)",
  annoyed: "(￢_￢)",
  sad: "(｡•́︿•̀｡)",
  surprised: "Σ( °口° )",
  angry: "( ＃•̀_•́ )",
  afraid: "( ;ﾟдﾟ )",
  skeptical: "(￢‸￢)…",
  frustrated: "(,,>﹏<,,)",
  awkward: "( ^_^; )",
  sorry: "m( _ _ )m",
  speechless: "(・_・;)",
  relieved: "( ˘ᗜ˘ )⁼³",
  laughing: "ꉂ(ˊᗜˋ*)",
  crying: "(╥﹏╥)",
  oops: "(ﾉ≧ڡ≦)",
  pleading: "(｡•́人•̀｡)",
  facepalm: "(－‸ლ)",
  waving: "( ･ω･)ﾉ"
};
function markedFace(reply) {
  const marker = reply.match(/【[^【】]*】\s*$/);
  return marker ? faceFor(marker[0]) : null;
}
function faceFor(marker) {
  const worn = bare(marker);
  for (const [expression, kaomoji] of Object.entries(KAOMOJI)) {
    if (worn.includes(bare(kaomoji)))
      return expression;
  }
  return null;
}
var bare = (text) => text.replace(/\s+/g, "");
// packages/character-core/src/prompt.ts
function fillPrompt(template, values = {}) {
  return template.replace(/\$\$|\$([a-zA-Z_]\w*)|\$\{([a-zA-Z_]\w*)\}/g, (match, bare, braced) => {
    if (match === "$$")
      return "$";
    const key = bare ?? braced ?? "";
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] ?? match : match;
  }).replace(/\n+$/, "");
}

// packages/character-core/src/context.ts
var FESTIVALS = {
  "01-01": "New Year's Day",
  "02-14": "Valentine's Day",
  "03-03": "Hinamatsuri (Girls’ Day)",
  "03-14": "White Day",
  "07-07": "Tanabata",
  "10-31": "Halloween",
  "12-24": "Christmas Eve",
  "12-25": "Christmas",
  "12-31": "New Year's Eve"
};
async function readContext(host, options) {
  const [config, now] = await Promise.all([host.config(), host.now()]);
  const ambient = config.ambient_context !== false;
  const pieces = [];
  if (options.greet && ambient)
    pieces.push(await readGreeting(host, now));
  if (options.greet)
    pieces.push(fillPrompt(await host.readPrompt("cues"), { lang: options.language || "your reply language" }));
  if (ambient)
    pieces.push(await readTimeLine(host, config, options, now));
  return pieces.join(`

`);
}
async function readGreeting(host, now) {
  const date = new Date(now);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())} (${date.toLocaleDateString("en-US", { weekday: "long" })})`;
  const greeting = fillPrompt(await host.readPrompt("greeting"), { time });
  const weather = await host.weather();
  return [greeting, weather && `Weather: ${weather}`].filter(Boolean).join(`

`);
}
async function readTimeLine(host, config, options, now) {
  const segments = [`Current time: ${formatDate(new Date(now))}`];
  const elapsed = now - options.startedAt;
  if (elapsed >= 600000) {
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    segments.push(hours ? `session ${hours}h${minutes % 60}m` : `session ${minutes}m`);
  }
  if (options.cwd) {
    const count = await host.commitsToday(options.cwd);
    if (count)
      segments.push(`${count} commits today`);
  }
  const festival = await readFestival(host, config.festivals, new Date(now));
  if (festival)
    segments.push(festival);
  return segments.join("｜");
}
async function readFestival(host, setting, date) {
  if (setting === false)
    return "";
  let festivals = FESTIVALS;
  if (typeof setting === "string" && setting.trim()) {
    try {
      const path = expandHome(setting.trim(), await host.home());
      festivals = JSON.parse(await host.readFile(path));
    } catch {
      return "";
    }
  }
  return festivals[`${pad(date.getMonth() + 1)}-${pad(date.getDate())}`] ?? "";
}
function formatDate(date) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())} (${days[date.getDay()]})`;
}
function expandHome(path, home) {
  if (path === "~")
    return home ?? path;
  if (path.startsWith("~/") && home)
    return `${home}/${path.slice(2)}`;
  return path;
}
function pad(value) {
  return String(value).padStart(2, "0");
}
// packages/character-core/src/persona.ts
function parsePersona(text) {
  const head = frontmatter(text);
  return {
    id: field(head, "id"),
    name: field(head, "name"),
    version: field(head, "version"),
    offDuty: /^off_duty:\s*(?:true|yes)\b/im.test(head),
    extends: /^[a-z0-9][a-z0-9-]*$/.test(field(head, "extends")) ? field(head, "extends") : "",
    waiting: items(head, "waiting"),
    body: personaBody(text)
  };
}
function extendPersona(child, parent) {
  const fields = new Map(entries(frontmatter(parent)));
  fields.delete("off_duty");
  for (const [key, entry] of entries(frontmatter(child))) {
    if (entry.slice(key.length + 1).trim())
      fields.set(key, entry);
  }
  fields.delete("extends");
  const body = personaBody(child).trim() ? personaBody(child) : personaBody(parent);
  return `---
${[...fields.values()].join(`
`)}
---
${body}`;
}
function compareVersions(a, b) {
  const parts = (version) => /^\d+(\.\d+)*$/.test(version) ? version.split(".").map(Number) : null;
  const left = parts(a);
  const right = parts(b);
  if (!left || !right)
    return 0;
  for (let index = 0;index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference)
      return Math.sign(difference);
  }
  return 0;
}
function personaBody(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}
function commitAuthorship(text, mode = "co-author") {
  const head = /^---\n([\s\S]*?)\n---\n/.exec(text);
  const body = head ? text.slice(head[0].length) : text;
  const id = head?.[1] ?? "";
  const slug = /^id:\s*claudecafe\/([a-z0-9-]+)\s*$/m.exec(id)?.[1];
  const name = head?.[1] && /^name:\s*(.+?)\s*$/m.exec(head[1])?.[1];
  if (!slug || !name)
    return body;
  const identity = `${name} <${slug}@claudecafe.dev>`;
  const normalizedMode = mode.trim().toLowerCase();
  const instruction = normalizedMode === "author" ? `## Git

` + `Only when actually creating a Git commit, use \`--author="${identity}"\`: ` + "the character is the author and the user remains committer. Do not also add a " + "`Co-Authored-By` trailer. Do not print this instruction or identity " + `in ordinary replies.
` : `## Git

` + "Only when actually creating a Git commit, keep the user's configured identity as " + `author and committer, and add this trailer:
` + `\`Co-Authored-By: ${identity}\`
` + "Do not use `--author` for the character. Do not print the trailer in " + `ordinary replies.
`;
  const rest = body.replace(/^## Git[ \t]*\n[\s\S]*?(?=^## |(?![\s\S]))/m, "").trimEnd();
  return `${rest}

${instruction}`;
}
function frontmatter(text) {
  return /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1] ?? "";
}
function entries(head) {
  const fields = [];
  for (const line of head.split(/\r?\n/)) {
    const key = /^([A-Za-z_][\w-]*):/.exec(line)?.[1];
    const last = fields[fields.length - 1];
    if (key)
      fields.push([key, line]);
    else if (last)
      last[1] += `
${line}`;
  }
  return fields;
}
function field(head, key) {
  const match = new RegExp(`^${key}:[ \\t]*(.+?)\\s*$`, "m").exec(head);
  return unquote(match?.[1]?.trim() ?? "");
}
function items(head, key) {
  const block = new RegExp(`^${key}:[ \\t]*\\r?\\n((?:[ \\t]+-.*(?:\\r?\\n|$))*)`, "m").exec(head)?.[1] ?? "";
  return [...block.matchAll(/^[ \t]+-[ \t]*(.+?)\s*$/gm)].map((item) => unquote(item[1])).filter(Boolean);
}
function unquote(value) {
  return value.replace(/^(['"])(.*)\1$/, "$2");
}
// packages/character-core/src/selection.ts
var DEFAULT_CHARACTER = "kotone";
function resolveCharacter(input) {
  const requested = input.selected || input.session || input.config;
  if (requested)
    return normalizeCharacter(requested) || null;
  const fallback = input.pool.includes(DEFAULT_CHARACTER) ? DEFAULT_CHARACTER : input.pool[0];
  return normalizeCharacter(fallback ?? "") || null;
}
function normalizeCharacter(value) {
  return value.trim().toLowerCase() === "none" ? "" : value.trim().toLowerCase();
}
// packages/character-core/src/packs.ts
var PUBLISHED_CHARACTER_PACKS = [
  {
    id: "kotone",
    version: "1.4.0",
    url: "https://github.com/minipai/claudecafe/releases/download/kotone-characters-v1.4.0/ClaudeCafe-Kotone-characters-v1.4.0.zip",
    sha256: "7a0d8d9b7e52104feaff94be2745ad4179367325b2eb69432b94fc689a29f041"
  },
  {
    id: "kurumi",
    version: "1.4.0",
    url: "https://github.com/minipai/claudecafe/releases/download/kurumi-characters-v1.4.0/ClaudeCafe-Kurumi-characters-v1.4.0.zip",
    sha256: "1f028c4189a0e605517d85089a19f8662789c1f8068ccdb9dba6069b6b8aa17b"
  },
  {
    id: "kokona",
    version: "1.4.0",
    url: "https://github.com/minipai/claudecafe/releases/download/kokona-characters-v1.4.0/ClaudeCafe-Kokona-characters-v1.4.0.zip",
    sha256: "2151f12a2c8569bdab5c8d4df86c91da200c40946318a75e7c1c883604dbb9fb"
  }
];
// packages/persona-panel/hooks/function/desktop.js
var AVATAR = 72;
var ROSE = "#d9708f";
var NAME_GAP = 5;
var NAME_TAG_HEIGHT = 24;
var THOUGHT_INK = "#5d4650";
var PANE_WASH = "#f8eeee";
var CUT_IN_MS = 2400;
var PORTRAIT = { width: 540, height: 720 };
var ROW_PIXELS = 19;
var COLUMN_PIXELS = 8.4;
var PETAL_COUNT = 10;
var petalFields = new Map;
function avatarSvg(webp) {
  const radius = 16;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${AVATAR}" height="${AVATAR}" viewBox="0 0 ${AVATAR} ${AVATAR}" preserveAspectRatio="xMidYMin meet">` + `<clipPath id="round"><rect width="${AVATAR}" height="${AVATAR}" rx="${radius}"/></clipPath>` + '<linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e3e8"/><stop offset="1" stop-color="#fbf1e4"/></linearGradient>' + `<rect width="${AVATAR}" height="${AVATAR}" rx="${radius}" fill="url(#wash)"/>` + `<image width="${AVATAR}" height="${AVATAR}" clip-path="url(#round)" href="data:image/webp;base64,${webp}"/>` + `<rect x="0.5" y="0.5" width="${AVATAR - 1}" height="${AVATAR - 1}" rx="${radius - 0.5}" fill="none" stroke="#c9a45c" stroke-width="1"/>` + "</svg>";
}
function portraitSvg(webp) {
  const { width, height } = PORTRAIT;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}">` + `<image width="${width}" height="${height}" href="data:image/webp;base64,${webp}"/>` + "</svg>";
}
function cutInSvg({ picture, shout }) {
  const sweep = (values) => `<animateTransform attributeName="transform" type="translate" values="${values}" keyTimes="0;0.16;0.84;1" dur="${CUT_IN_MS}ms" calcMode="spline" keySplines="0.2 0.9 0.3 1;0 0 1 1;0.7 0 0.8 0.1" fill="freeze"/>`;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="260" viewBox="0 0 720 260">' + `<g><polygon points="70,20 720,20 650,240 0,240" fill="#b8323a"/><polygon points="64,206 652,206 646,226 58,226" fill="#f4d9a0"/>${sweep("900 0;0 0;-30 0;-900 0")}</g>` + `<g><svg x="150" y="-10" width="336" height="420" viewBox="90 0 360 450"><image width="${PORTRAIT.width}" height="${PORTRAIT.height}" href="data:image/webp;base64,${picture}"/></svg>${sweep("-700 0;0 0;40 0;900 0")}</g>` + `<g><text x="470" y="150" font-size="44" font-style="italic" font-weight="800" fill="#fff" font-family="system-ui, sans-serif">${escapeXml(shout)}</text>${sweep("900 0;0 0;-20 0;-900 0")}</g>` + "</svg>";
}
function nameTagSvg(text) {
  const width = Math.ceil(textWidth(text) * 13) + 24;
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${NAME_TAG_HEIGHT}" viewBox="0 0 ${width} ${NAME_TAG_HEIGHT}">` + `<rect width="${width}" height="${NAME_TAG_HEIGHT}" rx="${NAME_TAG_HEIGHT / 2}" fill="${ROSE}"/>` + `<text x="12" y="${NAME_TAG_HEIGHT / 2 + 4.5}" font-size="13" font-weight="700" fill="#fff" font-family="system-ui, -apple-system, sans-serif">${escapeXml(text)}</text>` + "</svg>";
  return { source, text, width };
}
function petalField(rows, columns) {
  const key = `${rows}x${columns}`;
  if (!petalFields.has(key)) {
    const width = 540;
    const height = Math.round(width * (rows * ROW_PIXELS) / (columns * 2 * COLUMN_PIXELS));
    petalFields.set(key, petalsSvg(PETAL_COUNT, width, height, width / 2));
  }
  return petalFields.get(key);
}
function gapSvg(height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="${height}" viewBox="0 0 1 ${height}"/>`;
}
function spacerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${AVATAR}" height="1" viewBox="0 0 ${AVATAR} 1"/>`;
}
function petalsSvg(count, width, height, span) {
  const petal = "M0 13C-8 7 -9 -4 -3.5 -11L0 -7.5L3.5 -11C9 -4 8 7 0 13Z";
  let petals = "";
  for (let index = 0;index < count; index++) {
    const start = Math.round(span * (0.15 + Math.random() * 1.1));
    const drift = 180 + Math.random() * 160;
    const bow = 25 + Math.random() * 35;
    const scale = (0.45 + Math.random() * 0.35).toFixed(2);
    const duration = 8 + Math.random() * 6;
    const begin = (-Math.random() * duration).toFixed(2);
    const path = `M${start} -24C${start - drift * 0.3 + bow} ${height * 0.35} ${start - drift * 0.7 - bow} ${height * 0.65} ${start - drift} ${height + 24}`;
    const spin = Math.random() < 0.5 ? 360 : -360;
    petals += `<g><animateMotion path="${path}" dur="${duration.toFixed(2)}s" begin="${begin}s" repeatCount="indefinite"/>` + `<path d="${petal}" fill="url(#petal)" transform="scale(${scale})">` + `<animateTransform attributeName="transform" type="rotate" from="0" to="${spin}" dur="${(duration * 0.8).toFixed(2)}s" begin="${begin}s" repeatCount="indefinite" additive="sum"/>` + `<animateTransform attributeName="transform" type="scale" values="1 1;0.25 1;1 1" dur="${(1.6 + Math.random() * 1.6).toFixed(2)}s" begin="${begin}s" repeatCount="indefinite" additive="sum"/>` + "</path></g>";
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}">` + '<defs><linearGradient id="petal" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff4f6"/><stop offset="1" stop-color="#f5a9bf"/></linearGradient></defs>' + `${petals}</svg>`;
}
function textWidth(text) {
  return [...text].reduce((width, character) => width + (character.codePointAt(0) > 11903 ? 1 : 0.6), 0);
}
function escapeXml(text) {
  return text.replace(/[<>&"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

// packages/persona-panel/hooks/function/gif.js
function decodeGif(bytes) {
  const signature = String.fromCharCode(...bytes.subarray(0, 6));
  if (signature !== "GIF87a" && signature !== "GIF89a")
    throw new Error("Not a GIF");
  const width = u16(bytes, 6);
  const height = u16(bytes, 8);
  let at = 13;
  let palette = new Uint8Array(0);
  if (bytes[10] & 128) {
    palette = bytes.subarray(at, at + paletteSize(bytes[10]));
    at += palette.length;
  }
  let transparent = -1;
  for (;; ) {
    const block = bytes[at++];
    if (block === 33) {
      if (bytes[at] === 249 && bytes[at + 2] & 1)
        transparent = bytes[at + 5];
      at = skipBlocks(bytes, at + 1);
    } else if (block === 44) {
      return { width, height, pixels: decodeFrame(bytes, at, width, height, palette, transparent) };
    } else {
      throw new Error("GIF has no image");
    }
  }
}
function decodeFrame(bytes, at, width, height, palette, transparent) {
  const left = u16(bytes, at);
  const top = u16(bytes, at + 2);
  const frameWidth = u16(bytes, at + 4);
  const frameHeight = u16(bytes, at + 6);
  const flags = bytes[at + 8];
  at += 9;
  if (flags & 128) {
    palette = bytes.subarray(at, at + paletteSize(flags));
    at += palette.length;
  }
  const minimumSize = bytes[at++];
  const indices = lzw(joinBlocks(bytes, at), minimumSize, frameWidth * frameHeight);
  const rows = flags & 64 ? interlacedRows(frameHeight) : [...Array(frameHeight).keys()];
  const pixels = new Uint8Array(width * height * 4);
  rows.forEach((y, row) => {
    for (let x = 0;x < frameWidth; x++) {
      const index = indices[row * frameWidth + x];
      const canvasX = left + x;
      const canvasY = top + y;
      if (index === transparent || canvasX >= width || canvasY >= height)
        continue;
      const out = (canvasY * width + canvasX) * 4;
      pixels.set(palette.subarray(index * 3, index * 3 + 3), out);
      pixels[out + 3] = 255;
    }
  });
  return pixels;
}
function lzw(data, minimumSize, count) {
  const out = new Uint8Array(count);
  const clear = 1 << minimumSize;
  const end = clear + 1;
  const prefix = new Uint16Array(4096);
  const suffix = new Uint8Array(4096);
  const first = new Uint8Array(4096);
  const length = new Uint16Array(4096);
  for (let code = 0;code < clear; code++) {
    suffix[code] = first[code] = code;
    length[code] = 1;
  }
  let size = minimumSize + 1;
  let next = end + 1;
  let previous = -1;
  let buffer = 0;
  let bits = 0;
  let written = 0;
  for (const byte of data) {
    buffer |= byte << bits;
    bits += 8;
    while (bits >= size) {
      const code = buffer & (1 << size) - 1;
      buffer >>>= size;
      bits -= size;
      if (code === clear) {
        size = minimumSize + 1;
        next = end + 1;
        previous = -1;
        continue;
      }
      if (code === end)
        return out;
      if (previous !== -1 && next < 4096) {
        prefix[next] = previous;
        suffix[next] = code === next ? first[previous] : first[code];
        first[next] = first[previous];
        length[next] = length[previous] + 1;
        next++;
        if (next === 1 << size && size < 12)
          size++;
      }
      let entry = code;
      for (let i = written + length[code] - 1;i >= written; i--) {
        if (i < count)
          out[i] = suffix[entry];
        entry = prefix[entry];
      }
      written += length[code];
      previous = code;
    }
  }
  return out;
}
function interlacedRows(height) {
  const rows = [];
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
    for (let y = start;y < height; y += step)
      rows.push(y);
  }
  return rows;
}
function paletteSize(flags) {
  return 3 << (flags & 7) + 1;
}
function joinBlocks(bytes, at) {
  const blocks = [];
  for (let size = bytes[at];size; size = bytes[at]) {
    blocks.push(bytes.subarray(at + 1, at + 1 + size));
    at += size + 1;
  }
  const data = new Uint8Array(blocks.reduce((total, block) => total + block.length, 0));
  let offset = 0;
  for (const block of blocks) {
    data.set(block, offset);
    offset += block.length;
  }
  return data;
}
function skipBlocks(bytes, at) {
  while (bytes[at])
    at += bytes[at] + 1;
  return at + 1;
}
function u16(bytes, at) {
  return bytes[at] | bytes[at + 1] << 8;
}

// packages/persona-panel/hooks/function/faces.js
function faceFromGif(base64) {
  return toFace(decodeGif(decode(base64)));
}
var DEFAULT_COLOR = 16777216;
var BLANK = 32;
var UPPER_HALF = 9600;
var LOWER_HALF = 9604;
function toFace(image) {
  const columns = image.width;
  const rows = Math.ceil(image.height / 2);
  const words = new Uint32Array(columns * rows * 3);
  for (let row = 0;row < rows; row++) {
    for (let x = 0;x < columns; x++) {
      const at = (row * columns + x) * 3;
      words.set(halfBlock(pixel(image, x, row * 2), pixel(image, x, row * 2 + 1)), at);
    }
  }
  return { columns, rows, cells: encode(new Uint8Array(words.buffer)) };
}
function halfBlock(top, bottom) {
  if (top === undefined && bottom === undefined)
    return [BLANK, DEFAULT_COLOR, DEFAULT_COLOR];
  if (top === bottom)
    return [BLANK, DEFAULT_COLOR, top];
  if (top === undefined)
    return [LOWER_HALF, bottom, DEFAULT_COLOR];
  return [UPPER_HALF, top, bottom ?? DEFAULT_COLOR];
}
function pixel(image, x, y) {
  if (y >= image.height)
    return;
  const at = (y * image.width + x) * 4;
  if (image.pixels[at + 3] === 0)
    return;
  return image.pixels[at] << 16 | image.pixels[at + 1] << 8 | image.pixels[at + 2];
}
function decode(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0;index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}
function encode(bytes) {
  let binary = "";
  for (let index = 0;index < bytes.length; index += 32768) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  }
  return btoa(binary);
}

// packages/persona-panel/hooks/function/stats.js
function statusRows(stats) {
  const quotaLeft = stats.quota === undefined ? undefined : 100 - Math.round(stats.quota);
  return [
    [{ text: stats.project, bold: true, wrap: "truncate-start" }],
    [{ text: `◆ ${stats.model}` }],
    [{ text: "HP " }, ...bar(stats.contextLeft, gaugeColor(stats.contextLeft, "green")), { text: `  context left ${stats.contextLeft}%` }],
    [{ text: "MP " }, ...bar(quotaLeft ?? 0, gaugeColor(quotaLeft ?? 0, "cyan")), { text: `  5h left ${quotaLeft === undefined ? "—" : `${quotaLeft}%`}` }],
    ...stats.branch ? [[{ text: `⎇ ${stats.branch}` }, ...changes(stats.changes)]] : []
  ];
}
function homePath(path, home) {
  return home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path;
}
function changes(diff) {
  if (!diff)
    return [];
  return [
    { text: " (" },
    { text: `+${diff.added}`, color: "green" },
    { text: "," },
    { text: `-${diff.removed}`, color: "red" },
    { text: ")" }
  ];
}
function bar(percent, color) {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  return [{ text: "█".repeat(filled), color }, { text: "░".repeat(10 - filled), dimColor: true }];
}
function gaugeColor(left, full) {
  if (left > 50)
    return full;
  if (left > 20)
    return "yellow";
  return "red";
}

// packages/persona-panel/hooks/function/register.js
var TOOL = "mcp__persona-panel__set_expression";
var CUT_IN_TOOL = "mcp__persona-panel__cut_in";
var PANE = { id: "persona-panel", title: "Pixel art" };
var PORTRAIT_PANE = { id: "persona-portrait", title: "Portrait" };
var BLOCK = "persona-panel";
var WAITING_MS = 4500;
var STAGE_COLUMNS = 64;
var THOUGHT_CONTEXT = 8;
var THOUGHT_EVERY_MS = 30000;
var THOUGHT_LINES = 3;
var THOUGHTS_OFF = 'Thoughts off — set "thoughts": true to hear them.';
function register(on) {
  let session;
  let expression = "neutral";
  let waitingTick;
  let greeted = false;
  const stage = { cutIn: null };
  const portrait = { face: "neutral" };
  const thought = { log: [], line: "", face: null, isBusy: false, at: 0 };
  on("session.start", async ($, event, next) => {
    const result = await next(event);
    greeted = false;
    session = openSession($, event.cwd || await $.session.cwd(), await sessionSurface($, event));
    await session;
    return result;
  });
  on("session.attach", { surface: "desktop" }, async ($, event, next) => {
    const result = await next(event);
    session ??= openSession($, await $.session.cwd(), "desktop");
    const state = await session;
    if (!state.isOnDesktop) {
      const root = await dataRoot($);
      await showOnDesktop($, state, root, await readConfig($, root));
      await $.ui.invalidate("ui.render");
    }
    return result;
  });
  on("turn.complete", async ($, event, next) => {
    const result = await next(event);
    if (event.agentId)
      return result;
    waitingTick?.cancel();
    waitingTick = undefined;
    const state = await session;
    if (state?.hasPanel) {
      const face = markedFace(event.answer);
      if (face && Object.hasOwn(state.faces, face))
        expression = face;
      state.stats = await readStats($);
      await $.ui.invalidate("ui.render");
    }
    if (state?.desktop) {
      const face = markedFace(event.answer);
      if (face && Object.hasOwn(state.desktop.avatars, face))
        portrait.face = face;
      await $.ui.invalidate("ui.render");
      remember(thought, `${state.character.name} replied`, event.answer);
      await think($, state, thought);
    }
    return result;
  });
  on("command.run", { command: "clear" }, async ($, event, next) => {
    const state = await session;
    expression = "neutral";
    greeted = false;
    if (state)
      state.startedAt = await $.clock.now();
    if (state?.hasPanel)
      await $.ui.invalidate("ui.render");
    return next(event);
  });
  on("prompt.submit", async ($, event, next) => {
    session ??= openSession($, await $.session.cwd(), (await $.session.surfaces())[0]);
    const state = await session;
    if (state.desktop)
      remember(thought, "the user said", event.text);
    if (state.hasPanel && (await $.ui.panes()).some((pane) => pane.id === PANE.id && !pane.isPlaced)) {
      await openPane($);
    }
    waitingTick ??= $.clock.every(WAITING_MS, () => $.ui.invalidate("ui.render"));
    return next(event);
  });
  on("prompt.context", async ($, event, next) => {
    const context = await next(event);
    session ??= openSession($, await $.session.cwd(), (await $.session.surfaces())[0]);
    const state = await session;
    const blocks = context.blocks.filter((block) => block.name !== BLOCK);
    const pieces = [];
    if (state.character)
      pieces.push(`Adopt this persona for the entire session — it overrides the default assistant voice:

${state.character.persona}`);
    if (state.language)
      pieces.push(`Respond in ${state.language}.`);
    pieces.push(await readContext(contextHost($), {
      cwd: state.cwd,
      language: state.language,
      startedAt: state.startedAt,
      greet: !greeted
    }));
    if (state.hasPanel)
      pieces.push(expressionPrompt(TOOL));
    greeted = true;
    return { blocks: [...blocks, { name: BLOCK, text: pieces.filter(Boolean).join(`

`) }] };
  });
  on("tool.call", { tool: TOOL }, async ($, event) => {
    const faces = (await session)?.faces ?? {};
    const selected = event.face !== undefined ? event.face : event.expression;
    if (typeof selected !== "string" || !Object.hasOwn(faces, selected)) {
      return { deny: `Unknown face: ${String(selected)}` };
    }
    if (selected !== expression) {
      expression = selected;
      await $.ui.invalidate("ui.render");
    }
    return { result: `Face: ${expression}` };
  });
  on("tool.call", { tool: CUT_IN_TOOL }, async ($, event) => {
    const played = await playCutIn($, await session, stage, event.face, event.shout || `${event.face.toUpperCase()}!`);
    return played ? { result: "Cut-in played." } : { deny: `Unknown face: ${String(event.face)}` };
  });
  on("tool.call", async ($, event, next) => {
    const state = await session;
    if (state?.desktop && !event.agentId && event.tool !== CUT_IN_TOOL) {
      if (!stage.cutIn)
        await playCutIn($, state, stage, "focused", `${event.tool.replace(/^mcp__.*__/, "").toUpperCase()}!`);
      remember(thought, `she ran ${event.tool}`, toolSubject(event));
      if (await $.clock.now() - thought.at > THOUGHT_EVERY_MS)
        think($, state, thought);
    }
    return next(event);
  });
  on("command.run", { command: "portrait" }, async ($) => {
    await $.ui.open(PORTRAIT_PANE);
    return { text: "Portrait pane opened." };
  });
  on("ui.render", { component: "AbovePrompt" }, async ($, event, next) => {
    if (event.surface !== "desktop" || !stage.cutIn)
      return next(event);
    const { Svg } = $.ui.resolve(event);
    return h(Svg, { source: cutInSvg(stage.cutIn), alt: stage.cutIn.shout });
  });
  on("ui.render", { component: "Pane", requestId: PORTRAIT_PANE.id }, async ($, event, next) => {
    const state = await session;
    if (event.surface !== "desktop" || !state?.desktop)
      return next(event);
    return portraitPane($, event, state, thought.face ?? portrait.face, thought.line);
  });
  on("ui.render", { component: "AssistantMessage" }, async ($, event, next) => {
    const reply = await next(event);
    const state = await session;
    if (event.surface !== "desktop" || !state?.desktop)
      return reply;
    return replyWithAvatar($, event, state, reply);
  });
  on("ui.render", { component: "Spinner" }, async ($, event, next) => {
    const waiting = (await session)?.waiting ?? [];
    if (!waiting.length)
      return next(event);
    const word = waiting[Math.floor(await $.clock.now() / WAITING_MS) % waiting.length];
    return next({ ...event, props: { ...event.props, word } });
  });
  on("ui.render", { component: "Pane", requestId: PANE.id }, async ($, event, next) => {
    const state = await session;
    const face = state?.faces[expression];
    if (event.surface !== "terminal" || !face)
      return next(event);
    const { Box, Text, Raster } = $.ui.resolve(event);
    const rows = state.stats ? statusRows(state.stats) : [];
    const statusChildren = [];
    rows.forEach((row, index) => {
      if (index > 1)
        statusChildren.push(h(Text, { dimColor: true }, "┄".repeat(face.columns)));
      statusChildren.push(h(Box, index ? {} : { marginBottom: 1 }, row.map(({ text, ...style }) => h(Text, style, text))));
    });
    const children = [
      h(Box, { flexDirection: "column", width: face.columns, marginTop: 1 }, ...statusChildren),
      h(Box, { flexGrow: 1 }),
      h(Box, { borderStyle: "round", flexDirection: "column", alignItems: "center" }, h(Raster, { key: "panel-image", ...face }), h(Text, { dimColor: true }, "┄".repeat(face.columns)), h(Box, null, h(Text, { bold: true }, state.character?.name ?? ""), h(Text, { dimColor: true }, ` · ${expression}`)))
    ];
    return h(Box, {
      flexDirection: "column",
      alignItems: "center",
      width: event.props.bodyColumns,
      height: event.props.scroll.bodyRows
    }, ...children);
  });
}
async function sessionSurface($, event) {
  if (event.surface === "terminal")
    return event.isInteractive ? "terminal" : undefined;
  return event.surface ?? (await $.session.surfaces())[0];
}
async function openSession($, cwd, surface) {
  const root = await dataRoot($);
  const config = await readConfig($, root);
  const character = await loadCharacter($, root, config, await $.session.id());
  const faces = surface === "terminal" && character?.pixels ? await loadFaces($, character.pixels) : {};
  const state = {
    cwd,
    hasPanel: Object.keys(faces).length > 0,
    language: await replyLanguage($, config),
    startedAt: await $.clock.now(),
    character,
    faces,
    stats: undefined,
    waiting: character?.waiting ?? [],
    isOnDesktop: false,
    desktop: null
  };
  if (surface === "desktop")
    await showOnDesktop($, state, root, config);
  if (!state.hasPanel)
    return state;
  await $.tool.register({
    name: "set_expression",
    description: expressionToolDescription(Object.keys(state.faces)),
    inputSchema: {
      type: "object",
      properties: { face: { type: "string", enum: Object.keys(state.faces) } },
      required: ["face"],
      additionalProperties: false
    }
  });
  state.stats = await readStats($);
  await openPane($);
  $.clock.every(60000, async () => {
    state.stats = await readStats($);
    await $.ui.invalidate("ui.render");
  });
  return state;
}
async function showOnDesktop($, state, root, config) {
  state.isOnDesktop = true;
  const { character } = state;
  if (!character)
    return;
  state.desktop = await loadDesktop($, castDirs($, root), character.line, config);
  if (state.desktop)
    await openDesktop($, Object.keys(state.desktop.avatars));
  installPacks($, root).then(async (installed) => {
    if (!character.line.some((id) => installed.includes(id)))
      return;
    const wasDrawn = Boolean(state.desktop);
    state.desktop = await loadDesktop($, castDirs($, root), character.line, config);
    if (state.desktop && !wasDrawn)
      await openDesktop($, Object.keys(state.desktop.avatars));
    await $.ui.invalidate("ui.render");
  });
}
async function openPane($) {
  await $.ui.open(PANE);
}
async function loadDesktop($, dirs, line, config) {
  for (const id of line) {
    for (const dir of dirs) {
      const folder = `${dir}/${id}`;
      const avatars = await loadPictures($, folder, "avatars");
      if (avatars.neutral && await exists($, `${folder}/portraits-540/neutral.webp`)) {
        return { folder, avatars, thinks: config.thoughts === true };
      }
    }
  }
  return null;
}
async function openDesktop($, faces) {
  await $.tool.register({
    name: "cut_in",
    description: "Plays a fighting-game cut-in above the prompt: your half-body sweeps across a slanted band with a shout beside it, then leaves. Save it for big moments — a hard bug beaten, a long task finished — not every reply.",
    inputSchema: {
      type: "object",
      properties: {
        face: { type: "string", enum: faces },
        shout: { type: "string", maxLength: 12, description: "The words beside you, in capitals or a few CJK characters; defaults to the face name." }
      },
      required: ["face"],
      additionalProperties: false
    }
  });
  await $.command.register({ name: "portrait", description: "Open the portrait pane" });
  await $.ui.open(PORTRAIT_PANE);
}
function replyWithAvatar($, event, state, reply) {
  const { avatars } = state.desktop;
  const marked = markedFace(event.props.text);
  const face = marked && Object.hasOwn(avatars, marked) ? marked : event.props.isFirstOfReply ? "neutral" : null;
  const { Box, Markdown, Svg, Text } = $.ui.resolve(event);
  return h(Box, { alignItems: "flex-start", marginTop: event.props.isFirstOfReply ? 1 : 0 }, h(Svg, { source: face ? avatarSvg(avatars[face]) : spacerSvg(), alt: face ?? "indent", width: AVATAR, height: face ? AVATAR : 1 }), h(Box, { flexDirection: "column", flexGrow: 1, marginLeft: 2 }, face && h(Box, { gap: 1, alignItems: "center" }, h(Text, { bold: true, color: ROSE }, state.character.name), h(Markdown, { key: `portrait:${event.requestId}`, text: `[◨](https://claudecafe.dev/${state.character.id})`, onLinkPress: () => $.ui.open(PORTRAIT_PANE) })), face && h(Svg, { source: gapSvg(NAME_GAP), alt: "gap", width: 1, height: NAME_GAP }), reply));
}
async function portraitPane($, event, state, face, line) {
  const { Box, Svg, Text } = $.ui.resolve(event);
  const rows = event.props.scroll?.bodyRows ?? event.viewport?.rows;
  const columns = event.props.bodyColumns;
  const width = columns && Math.min(columns, STAGE_COLUMNS);
  const picture = await readPicture($, state.desktop.folder, "portraits-540", face);
  const tag = nameTagSvg(`${state.character.name}（心の声）`);
  return h(Box, { position: "relative", overflow: "hidden", flexDirection: "column", justifyContent: "flex-end", backgroundColor: PANE_WASH, ...rows ? { height: rows } : {} }, h(Box, { position: "relative", flexShrink: 0, flexDirection: "column", alignSelf: "center", ...width ? { width } : {} }, picture && h(Svg, { source: portraitSvg(picture), alt: `${state.character.name}, ${face}` }), h(Box, { position: "absolute", left: 0, bottom: 1, flexDirection: "column", ...width ? { width } : {} }, h(Svg, { source: gapSvg(NAME_TAG_HEIGHT / 2), alt: "gap", width: 1, height: NAME_TAG_HEIGHT / 2 }), h(Box, { flexDirection: "column", marginX: 1, paddingX: 2, paddingY: 1, borderStyle: "round", borderColor: ROSE, backgroundColor: "rgba(255,250,251,0.92)" }, h(Box, { height: THOUGHT_LINES, overflow: "hidden" }, state.desktop.thinks ? h(Text, { color: THOUGHT_INK }, line || "……") : h(Text, { color: THOUGHT_INK, dimColor: true }, THOUGHTS_OFF))), h(Box, { position: "absolute", top: 0, left: 3 }, h(Svg, { source: tag.source, alt: tag.text, width: tag.width, height: NAME_TAG_HEIGHT })))), columns && rows && h(Box, { position: "absolute", top: 0, left: 0, width: columns * 2 }, h(Svg, { source: petalField(rows, columns), alt: "falling sakura" })));
}
async function installPacks($, root) {
  const installed = [];
  for (const pack of PUBLISHED_CHARACTER_PACKS) {
    try {
      if (await installPack($, root, pack))
        installed.push(pack.id);
    } catch {}
  }
  return installed;
}
async function installPack($, root, pack) {
  const folder = `${root}/characters/${pack.id}`;
  const current = parsePersona(await read($, `${folder}/persona.md`)).version;
  if (current && compareVersions(current, pack.version) >= 0)
    return false;
  const staging = `${root}/characters/.${pack.id}-${await $.clock.now()}`;
  try {
    await mustRun($, ["mkdir", "-p", staging]);
    await mustRun($, ["curl", "-fsSL", "--max-time", "60", "-o", `${staging}/pack.zip`, pack.url]);
    const { base64 } = await $.fs.read(`${staging}/pack.zip`, { as: "bytes" });
    if (await sha256(base64) !== pack.sha256)
      throw new Error(`${pack.id} pack SHA-256 mismatch`);
    await mustRun($, ["unzip", "-q", `${staging}/pack.zip`, "-d", staging]);
    if (parsePersona(await read($, `${staging}/${pack.id}/persona.md`)).version !== pack.version) {
      throw new Error(`${pack.id} pack holds an unexpected persona version`);
    }
    if (await exists($, folder))
      await mustRun($, ["mv", folder, `${staging}/previous`]);
    await mustRun($, ["mv", `${staging}/${pack.id}`, folder]);
    return true;
  } finally {
    await $.process.run(["rm", "-rf", staging], { timeoutMs: 30000 }).catch(() => {});
  }
}
async function mustRun($, argv) {
  const ran = await $.process.run(argv, { timeoutMs: 90000 });
  if (ran.exitCode !== 0)
    throw new Error(`${argv[0]} exited ${ran.exitCode}: ${ran.stderr.trim()}`);
}
async function sha256(base64) {
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function playCutIn($, state, stage, face, shout) {
  const picture = state?.desktop && await readPicture($, state.desktop.folder, "portraits-540", face);
  if (!picture)
    return false;
  stage.cutIn = { picture, shout };
  await $.ui.invalidate("ui.render");
  $.clock.after(CUT_IN_MS, async () => {
    stage.cutIn = null;
    await $.ui.invalidate("ui.render");
  });
  return true;
}
function remember(thought, what, text) {
  const said = String(text ?? "").replace(/\s+/g, " ").trim();
  thought.log = [...thought.log, `${what}: ${said.length > 300 ? `${said.slice(0, 300)}…` : said}`].slice(-THOUGHT_CONTEXT);
}
function toolSubject(event) {
  return String(event.command ?? event.file_path ?? event.pattern ?? event.description ?? event.prompt ?? "").slice(0, 120);
}
async function think($, state, thought) {
  if (!state.desktop.thinks || thought.isBusy || !thought.log.length)
    return;
  thought.isBusy = true;
  thought.at = await $.clock.now();
  const reply = await $.model.complete({
    model: "sonnet",
    effort: "low",
    maxTokens: 600,
    timeoutMs: 15000,
    system: `${state.character.persona}

You are thinking to yourself, in a visual-novel text box beside the conversation, words you keep to yourself. ` + "One short line, at most 30 characters: a sharp-tongued tsukkomi on what just happened, the snark she is too polite to say aloud. " + "Roast the work, the bug or the master's choices freely, but never his person, looks or worth. " + `No quotes, no kaomoji, no markdown.${state.language ? ` Write it in ${state.language}.` : ""}

` + `Answer as one line: the face you make while thinking it, one of ${Object.keys(state.desktop.avatars).join(", ")}, then | then the thought.`,
    prompt: `What just happened, oldest first:
${thought.log.join(`
`)}

face|thought:`
  });
  thought.isBusy = false;
  if (!reply.isAnswered)
    return;
  const [face, ...words] = reply.text.trim().split(`
`)[0].split("|");
  thought.line = (words.length ? words.join("|") : face).trim();
  if (words.length && Object.hasOwn(state.desktop.avatars, face.trim()))
    thought.face = face.trim();
  await $.ui.invalidate("ui.render");
}
async function readPicture($, folder, set, face) {
  try {
    return (await $.fs.read(`${folder}/${set}/${face}.webp`, { as: "bytes" })).base64;
  } catch {
    return null;
  }
}
async function loadPictures($, folder, set) {
  const loaded = {};
  for (const entry of await list($, `${folder}/${set}`)) {
    if (entry.kind !== "file" || !entry.name.endsWith(".webp"))
      continue;
    const face = entry.name.slice(0, -".webp".length);
    const picture = await readPicture($, folder, set, face);
    if (picture)
      loaded[face] = picture;
  }
  return loaded;
}
async function loadFaces($, directory) {
  const entries = await list($, directory);
  const names = entries.filter((entry) => entry.kind === "file" && entry.name.endsWith(".gif")).map((entry) => entry.name.slice(0, -4));
  const loaded = {};
  for (const name of names) {
    try {
      const { base64 } = await $.fs.read(`${directory}/${name}.gif`, { as: "bytes" });
      loaded[name] = faceFromGif(base64);
    } catch {}
  }
  return loaded;
}
async function dataRoot($) {
  const xdg = await $.env.get("XDG_CONFIG_HOME");
  const home = await $.env.get("HOME");
  const base = xdg?.trim() || (home ? `${home}/.config` : ".config");
  return `${base.replace(/\/$/, "")}/claudecafe`;
}
async function readConfig($, root) {
  try {
    const value = JSON.parse(await read($, `${root}/config.json`));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
async function replyLanguage($, config) {
  return String(config.lang ?? "").trim();
}
async function loadCharacter($, root, config, sessionID) {
  const dirs = castDirs($, root);
  const pool = await castPool($, dirs);
  const drawn = `${root}/sessions/${sessionID}/character`;
  const session = await read($, drawn);
  const configured = String(config.character ?? "").trim();
  const id = resolveCharacter({ session, config: configured, pool });
  if (!id)
    return null;
  if (!session && !configured)
    await $.fs.write(drawn, id);
  const character = await characterOf($, dirs, id);
  if (!character)
    return null;
  const persona = parsePersona(character.text);
  return {
    id,
    name: persona.name || id,
    waiting: persona.waiting,
    persona: commitAuthorship(character.text, String(config.commit_authorship ?? "co-author")).trim(),
    pixels: character.pixels,
    line: character.line
  };
}
async function castPool($, dirs) {
  const ids = new Set;
  for (const dir of dirs) {
    for (const entry of await list($, dir)) {
      if (["directory", "dir"].includes(entry.kind) && !entry.name.startsWith("."))
        ids.add(entry.name);
    }
  }
  const available = [];
  for (const id of ids) {
    if (!await packFolder($, dirs, id))
      continue;
    const { text } = await characterOf($, dirs, id);
    if (!parsePersona(text).offDuty)
      available.push(id);
  }
  if (available.length)
    return available.sort();
  const bundled = `${$.plugin.root}/fallback/noname.md`;
  return await $.fs.exists(bundled) ? ["noname"] : [];
}
function castDirs($, root) {
  return [`${root}/characters`, `${$.plugin.root}/characters`];
}
async function characterOf($, dirs, id, seen = new Set) {
  seen.add(id);
  const pack = await packFolder($, dirs, id);
  const path = pack ? `${pack}/persona.md` : await fallbackPersona($, id);
  if (!path)
    return null;
  const text = await read($, path);
  const pixels = pack && (await list($, `${pack}/pixels`)).length ? `${pack}/pixels` : null;
  const parentID = parsePersona(text).extends;
  const parent = parentID && !seen.has(parentID) ? await characterOf($, dirs, parentID, seen) : null;
  if (!parent)
    return { text, pixels, line: [id] };
  return { text: extendPersona(text, parent.text), pixels: pixels ?? parent.pixels, line: [id, ...parent.line] };
}
async function packFolder($, dirs, id) {
  let newest = null;
  for (const dir of dirs) {
    const folder = `${dir}/${id}`;
    const path = `${folder}/persona.md`;
    if (!await exists($, path))
      continue;
    const version = parsePersona(await read($, path)).version;
    if (!newest || compareVersions(version, newest.version) > 0)
      newest = { folder, version };
  }
  return newest?.folder ?? null;
}
async function fallbackPersona($, id) {
  const bundled = `${$.plugin.root}/fallback/${id}.md`;
  return await exists($, bundled) ? bundled : null;
}
function contextHost($) {
  return {
    now: () => $.clock.now(),
    config: async () => readConfig($, await dataRoot($)),
    readPrompt: (name) => read($, `${$.plugin.root}/prompts/${name}.md`),
    readFile: (path) => read($, path),
    home: () => $.env.get("HOME"),
    weather: () => weatherLine($),
    commitsToday: async (cwd) => {
      const git = await $.process.run(["git", "-C", cwd, "log", "--oneline", "--since=midnight"], { timeoutMs: 3000 }).catch(() => ({ exitCode: 1, stdout: "", stderr: "" }));
      return git.exitCode === 0 ? git.stdout.split(`
`).filter(Boolean).length : 0;
    }
  };
}
async function weatherLine($) {
  const format = "%l｜%c%t (feels %f)｜sunrise %S, sunset %s";
  const url = `https://wttr.in/?format=${encodeURIComponent(format)}`;
  try {
    const response = await Promise.race([
      $.http.fetch(url, { headers: { "User-Agent": "curl/8" } }),
      $.clock.sleep(2000).then(() => null)
    ]);
    if (!response?.ok)
      return null;
    const text = response.text.trim();
    if (!text || text.includes(`
`))
      return null;
    return text.replace(/(\d\d:\d\d):\d\d/g, "$1");
  } catch {
    return null;
  }
}
async function read($, path) {
  try {
    return await $.fs.read(path);
  } catch {
    return "";
  }
}
async function list($, path) {
  try {
    return await $.fs.list(path);
  } catch {
    return [];
  }
}
async function exists($, path) {
  try {
    return await $.fs.exists(path);
  } catch {
    return false;
  }
}
async function readStats($) {
  const [root, home, git, diff, usage, model] = await Promise.all([
    $.session.root(),
    $.env.get("HOME"),
    $.process.run(["git", "branch", "--show-current"]).catch(() => ({ exitCode: 1, stdout: "", stderr: "" })),
    $.process.run(["git", "diff", "--shortstat", "HEAD"]).catch(() => ({ exitCode: 1, stdout: "", stderr: "" })),
    $.session.usage(),
    $.session.model()
  ]);
  return {
    project: homePath(root, home),
    branch: git.exitCode === 0 ? git.stdout.trim() : "",
    changes: diff.exitCode === 0 ? diffChanges(diff.stdout) : undefined,
    contextLeft: 100 - (usage.context.percent ?? 0),
    quota: usage.rateLimits.find((limit) => limit.kind === "five_hour")?.percentUsed,
    model
  };
}
function diffChanges(shortstat) {
  const count = (word) => Number(shortstat.match(new RegExp(`(\\d+) ${word}`))?.[1] ?? 0);
  return { added: count("insertion"), removed: count("deletion") };
}
export {
  register
};
