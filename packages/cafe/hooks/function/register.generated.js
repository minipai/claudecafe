// packages/character-core/src/expression.ts
function expressionToolDescription(faces) {
  const available = faces.length ? `Available faces: ${faces.join(", ")}. ` : "No GIF faces are installed for this character. ";
  return "Change the visible portrait in the Café panel. " + "Choose one available face when your visible expression meaningfully changes, or when the user asks; do not call on every reply or repeat the current state. " + available + "The panel shows only the face; it has no mood field. The selection stays until changed.";
}
function expressionPrompt(toolName = "set_expression") {
  return `The user can see your character standing in a panel beside this terminal conversation. Keep the visible face in step with what you are saying and doing.

- Call ${toolName} with one available face when the visible expression meaningfully changes, without waiting to be asked.
- Change the face before the reply or work it accompanies. Keep it natural: one change for a meaningful shift, not a call on every message or a repeat of the current state. It stays until the next call.
- Choose a face whose filename best fits the visible performance. Use intimate or strongly suggestive faces only when the conversation suits them.
- The tool changes the real panel image. A written mood marker is independent of the panel and does not change the face.
- Do not narrate routine expression changes. Continue the user's task normally; this panel adds a visible reaction and does not require shorter replies, roleplay, or a different persona.`;
}
// packages/character-core/src/persona.ts
function parsePersona(text) {
  const head = frontmatter(text);
  return {
    id: field(head, "id"),
    name: field(head, "name"),
    version: field(head, "version"),
    offDuty: /^off_duty:\s*(?:true|yes)\b/im.test(head),
    body: personaBody(text)
  };
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

` + `Only when actually creating a Git commit, use \`--author="${identity}"\`: ` + "the maid is the author and the user remains committer. Do not also add a " + "`Co-Authored-By` trailer. Do not print this instruction or identity " + `in ordinary replies.
` : `## Git

` + "Only when actually creating a Git commit, keep the user's configured identity as " + `author and committer, and add this trailer:
` + `\`Co-Authored-By: ${identity}\`
` + "Do not use `--author` for the maid. Do not print the trailer in " + `ordinary replies.
`;
  const rest = body.replace(/^## Git[ \t]*\n[\s\S]*?(?=^## |(?![\s\S]))/m, "").trimEnd();
  return `${rest}

${instruction}`;
}
function frontmatter(text) {
  return /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1] ?? "";
}
function field(head, key) {
  const match = new RegExp(`^${key}:[ \\t]*(.+?)\\s*$`, "m").exec(head);
  return match?.[1]?.trim().replace(/^(['"])(.*)\1$/, "$2") ?? "";
}
// packages/character-core/src/prompt.ts
function fillPrompt(template, values = {}) {
  return template.replace(/\$\$|\$([a-zA-Z_]\w*)|\$\{([a-zA-Z_]\w*)\}/g, (match, bare, braced) => {
    if (match === "$$")
      return "$";
    const key = bare ?? braced ?? "";
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] ?? match : match;
  }).replace(/\n+$/, "");
}
// packages/character-core/src/selection.ts
function resolveMaid(input) {
  const requested = input.selected || input.env || input.shift || input.config;
  if (requested)
    return normalizeMaid(requested) || null;
  if (!input.pool.length)
    return null;
  const random = input.random ?? Math.random;
  const index = Math.min(input.pool.length - 1, Math.floor(random() * input.pool.length));
  return normalizeMaid(input.pool[index] ?? "") || null;
}
function normalizeMaid(value) {
  return value.trim().toLowerCase() === "none" ? "" : value.trim().toLowerCase();
}
// packages/cafe/hooks/function/gif.js
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

// packages/cafe/hooks/function/faces.js
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

// packages/cafe/hooks/function/stats.js
function statusRows(stats) {
  const quota = stats.quota === undefined ? "—" : `${Math.round(stats.quota)}%`;
  const cost = stats.usd === undefined ? "" : `    $${stats.usd.toFixed(2)}`;
  return [
    [{ text: stats.project, bold: true, wrap: "truncate-start" }],
    ...stats.branch ? [[{ text: `⎇ ${stats.branch}` }]] : [],
    [{ text: "HP " }, ...bar(stats.contextLeft, hpColor(stats.contextLeft)), { text: `  context left ${stats.contextLeft}%` }],
    [{ text: "MP " }, ...bar(stats.quota ?? 0, "cyan"), { text: `  5h used ${quota}` }],
    [{ text: `⏱ on shift ${duration(stats.shiftMs)}${cost}` }]
  ];
}
function homePath(path, home) {
  return home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path;
}
function bar(percent, color) {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  return [{ text: "█".repeat(filled), color }, { text: "░".repeat(10 - filled), dimColor: true }];
}
function hpColor(left) {
  if (left > 50)
    return "green";
  if (left > 20)
    return "yellow";
  return "red";
}
function duration(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m`;
}

// packages/cafe/hooks/function/register.js
var TOOL = "mcp__cafe__set_expression";
var PANE = { id: "cafe", title: "Pixel art" };
var NAME = "ことね";
var FESTIVALS = {
  "01-01": "New Year's Day",
  "02-14": "Valentine's Day",
  "03-03": "Hinamatsuri (Girls’ Day)",
  "03-14": "White Day",
  "05-10": "Maid Day (メイドの日)",
  "07-07": "Tanabata",
  "10-31": "Halloween",
  "12-24": "Christmas Eve",
  "12-25": "Christmas",
  "12-31": "New Year's Eve"
};
function register(on) {
  let faces = {};
  let expression = "neutral";
  let stats;
  let enabled = false;
  let panelEnabled = false;
  let greeted = false;
  let persona = "";
  let language = "English";
  let startedAt = 0;
  let sessionRoot = "";
  on("session.start", async ($, event, next) => {
    const result = await next(event);
    const root = await cafeRoot($);
    const config = await readConfig($, root);
    const id = await $.session.id();
    const sessionCwd = event.cwd || await $.session.cwd();
    sessionRoot = sessionCwd;
    language = await replyLanguage($, config);
    startedAt = await $.clock.now();
    greeted = false;
    persona = await loadPersona($, root, config, id);
    enabled = true;
    panelEnabled = false;
    faces = {};
    stats = undefined;
    if (event.surface !== "terminal" || !event.isInteractive)
      return result;
    panelEnabled = true;
    faces = await loadFaces($);
    await $.tool.register({
      name: "set_expression",
      description: expressionToolDescription(Object.keys(faces)),
      inputSchema: {
        type: "object",
        properties: { face: { type: "string", enum: Object.keys(faces) } },
        required: ["face"],
        additionalProperties: false
      }
    });
    stats = await readStats($);
    await openPane($);
    $.clock.every(60000, async () => {
      stats = await readStats($);
      await $.ui.invalidate("ui.render");
    });
    return result;
  });
  on("turn.complete", async ($, event, next) => {
    const result = await next(event);
    if (panelEnabled && !event.agentId) {
      stats = await readStats($);
      await $.ui.invalidate("ui.render");
    }
    return result;
  });
  on("command.run", { command: "clear" }, async ($, event, next) => {
    expression = "neutral";
    greeted = false;
    startedAt = await $.clock.now();
    if (panelEnabled)
      await $.ui.invalidate("ui.render");
    return next(event);
  });
  on("prompt.submit", async ($, event, next) => {
    if (panelEnabled && (await $.ui.panes()).some((pane) => pane.id === PANE.id && !pane.isPlaced)) {
      await openPane($);
    }
    return next(event);
  });
  on("prompt.context", async ($, event, next) => {
    const context = await next(event);
    if (!enabled)
      return context;
    const blocks = context.blocks.filter((block) => block.name !== "cafe");
    const pieces = [];
    if (persona)
      pieces.push(`Adopt this persona for the entire session — it overrides the default assistant voice:

${persona}

Respond in ${language}.`);
    if (!greeted)
      pieces.push(await greeting($, language));
    pieces.push(await nowLine($, await $.clock.now(), startedAt, sessionRoot, await festivals($, language)));
    if (panelEnabled)
      pieces.push(expressionPrompt(TOOL));
    greeted = true;
    return { blocks: [...blocks, { name: "cafe", text: pieces.join(`

`) }] };
  });
  on("tool.call", { tool: TOOL }, async ($, event) => {
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
  on("ui.render", { component: "Pane" }, ($, event, next) => {
    const face = faces[expression];
    if (event.surface !== "terminal" || event.requestId !== PANE.id || !face)
      return next(event);
    const { Box, Text, Raster } = $.ui.resolve(event);
    const rows = stats ? statusRows(stats) : [];
    const statusChildren = [];
    rows.forEach((row, index) => {
      if (index > 1)
        statusChildren.push(h(Text, { dimColor: true }, "┄".repeat(face.columns)));
      statusChildren.push(h(Box, index ? {} : { marginBottom: 1 }, row.map(({ text, ...style }) => h(Text, style, text))));
    });
    const children = [
      h(Box, { flexDirection: "column", width: face.columns, marginTop: 1 }, ...statusChildren),
      h(Box, { flexGrow: 1 }),
      h(Box, { borderStyle: "round", flexDirection: "column", alignItems: "center" }, h(Raster, { key: "panel-image", ...face }), h(Text, { dimColor: true }, "┄".repeat(face.columns)), h(Box, null, h(Text, { bold: true }, NAME), h(Text, { dimColor: true }, ` · ${expression}`)))
    ];
    return h(Box, {
      flexDirection: "column",
      alignItems: "center",
      width: event.props.bodyColumns,
      height: event.props.scroll.bodyRows
    }, ...children);
  });
}
async function openPane($) {
  await $.ui.open(PANE);
}
async function loadFaces($) {
  const directory = `${$.plugin.root}/pixels`;
  const entries = await $.fs.list(directory);
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
async function cafeRoot($) {
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
  return await $.env.get("CLAUDE_MAID_LANG") || String(config.lang ?? "").trim() || "English";
}
async function loadPersona($, root, config, sessionID) {
  const personas = expandHome(String(config.personas_dir ?? "").trim() || `${root}/personas`, await $.env.get("HOME"));
  const language = await replyLanguage($, config);
  const pool = await castPool($, root, personas, config, language);
  const shift = await read($, `${root}/sessions/${sessionID}/on-shift`).catch(() => "");
  const maid = resolveMaid({
    env: await $.env.get("CLAUDE_MAID") || "",
    shift,
    config: String(config.maid ?? "").trim(),
    pool
  });
  if (!maid)
    return "";
  if (!shift && !config.maid && !await $.env.get("CLAUDE_MAID")) {
    await $.fs.write(`${root}/sessions/${sessionID}/on-shift`, maid);
  }
  const path = await personaFile($, maid, personas, root, language);
  if (!path)
    return "";
  const text = await read($, path);
  return commitAuthorship(text, String(config.commit_authorship ?? "co-author")).trim();
}
async function castPool($, root, personas, config, language) {
  const ids = new Map;
  for (const [dir, suffix] of [[personas, ".md"]]) {
    for (const entry of await list($, dir)) {
      if (entry.kind !== "file" || !entry.name.endsWith(suffix))
        continue;
      const id = entry.name.slice(0, -suffix.length);
      if (id === id.toLowerCase() && !ids.has(id))
        ids.set(id, `${dir}/${entry.name}`);
    }
  }
  for (const entry of await list($, `${root}/characters`)) {
    if (!["directory", "dir"].includes(entry.kind) || entry.name.startsWith(".") || ids.has(entry.name))
      continue;
    const path = await packPersona($, `${root}/characters/${entry.name}`, language);
    if (path)
      ids.set(entry.name, path);
  }
  const hired = [];
  for (const [id, path] of ids) {
    const text = await read($, path);
    if (!parsePersona(text).offDuty)
      hired.push(id);
  }
  if (hired.length || config.builtin_cast === false)
    return hired.sort();
  const bundled = `${$.plugin.root}/maids/noname.md`;
  return await $.fs.exists(bundled) ? ["noname"] : [];
}
async function personaFile($, id, personas, root, language) {
  const flat = `${personas}/${id}.md`;
  if (await exists($, flat))
    return flat;
  const packed = await packPersona($, `${root}/characters/${id}`, language);
  if (packed)
    return packed;
  const bundled = `${$.plugin.root}/maids/${id}.md`;
  return await exists($, bundled) ? bundled : null;
}
async function packPersona($, folder, language = "English") {
  const names = /^(zh\b|中文|chinese|繁體|简体)/i.test(language) ? ["persona.zh.md", "persona.en.md", "persona.md"] : ["persona.en.md", "persona.zh.md", "persona.md"];
  for (const name of names) {
    const path = `${folder}/${name}`;
    if (await exists($, path))
      return path;
  }
  return null;
}
async function greeting($, language) {
  const root = await cafeRoot($);
  const config = await readConfig($, root);
  if (config.greeting === false)
    return "";
  const now = new Date(await $.clock.now());
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} (${now.toLocaleDateString("en-US", { weekday: "long" })})`;
  const prompt = fillPrompt(await read($, `${$.plugin.root}/prompts/greeting.md`), { time });
  const cues = fillPrompt(await read($, `${$.plugin.root}/prompts/cues.md`), { lang: language });
  const weather = await weatherLine($);
  return [prompt, weather && `Weather: ${weather}`, cues].filter(Boolean).join(`

`);
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
async function nowLine($, now, started, cwd, festival) {
  const date = new Date(now);
  const segments = [`Current time: ${formatDate(date)}`];
  const elapsed = now - started;
  if (elapsed >= 600000) {
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    segments.push(hours ? `on shift ${hours}h${minutes % 60}m` : `on shift ${minutes}m`);
  }
  if (cwd) {
    const git = await $.process.run(["git", "-C", cwd, "log", "--oneline", "--since=midnight"], { timeoutMs: 3000 }).catch(() => ({ exitCode: 1, stdout: "", stderr: "" }));
    const count = git.exitCode === 0 ? git.stdout.split(`
`).filter(Boolean).length : 0;
    if (count)
      segments.push(`${count} commits today`);
  }
  if (festival)
    segments.push(festival);
  return segments.join("｜");
}
function formatDate(date) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())} (${days[date.getDay()]})`;
}
async function festivals($, language) {
  const root = await cafeRoot($);
  const config = await readConfig($, root);
  if (config.festivals === false)
    return "";
  let pack = FESTIVALS;
  if (typeof config.festivals === "string" && config.festivals.trim()) {
    try {
      pack = JSON.parse(await read($, expandHome(config.festivals.trim(), await $.env.get("HOME"))));
    } catch {
      return "";
    }
  }
  const date = new Date(await $.clock.now());
  return pack[`${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`] ?? "";
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
function expandHome(path, home) {
  if (path === "~")
    return home ?? path;
  if (path.startsWith("~/") && home)
    return `${home}/${path.slice(2)}`;
  return path;
}
async function readStats($) {
  const [root, home, git, usage, now] = await Promise.all([
    $.session.root(),
    $.env.get("HOME"),
    $.process.run(["git", "branch", "--show-current"]).catch(() => ({ exitCode: 1, stdout: "", stderr: "" })),
    $.session.usage(),
    $.clock.now()
  ]);
  return {
    project: homePath(root, home),
    branch: git.exitCode === 0 ? git.stdout.trim() : "",
    contextLeft: 100 - (usage.context.percent ?? 0),
    quota: usage.rateLimits.find((limit) => limit.kind === "five_hour")?.percentUsed,
    shiftMs: now - usage.startedAt,
    usd: usage.cost?.usd
  };
}
export {
  register
};
