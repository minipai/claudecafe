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
function personaFiles(variant = "") {
  return variant ? [`persona.${variant}.md`, "persona.md"] : ["persona.md"];
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
function resolveCharacter(input) {
  const requested = input.selected || input.session || input.config;
  if (requested)
    return normalizeCharacter(requested) || null;
  if (!input.pool.length)
    return null;
  const random = input.random ?? Math.random;
  const index = Math.min(input.pool.length - 1, Math.floor(random() * input.pool.length));
  return normalizeCharacter(input.pool[index] ?? "") || null;
}
function normalizeCharacter(value) {
  return value.trim().toLowerCase() === "none" ? "" : value.trim().toLowerCase();
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
  const cost = stats.usd === undefined ? "" : `    $${stats.usd.toFixed(2)}`;
  return [
    [{ text: stats.project, bold: true, wrap: "truncate-start" }],
    ...stats.branch ? [[{ text: `⎇ ${stats.branch}` }]] : [],
    [{ text: "HP " }, ...bar(stats.contextLeft, gaugeColor(stats.contextLeft, "green")), { text: `  context left ${stats.contextLeft}%` }],
    [{ text: "MP " }, ...bar(quotaLeft ?? 0, gaugeColor(quotaLeft ?? 0, "cyan")), { text: `  5h left ${quotaLeft === undefined ? "—" : `${quotaLeft}%`}` }],
    [{ text: `⏱ session ${duration(stats.sessionMs)}${cost}` }]
  ];
}
function homePath(path, home) {
  return home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path;
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
function duration(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m`;
}

// packages/persona-panel/hooks/function/register.js
var TOOL = "mcp__persona-panel__set_expression";
var PANE = { id: "persona-panel", title: "Pixel art" };
var BLOCK = "persona-panel";
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
function register(on) {
  let session;
  let expression2 = "neutral";
  let greeted = false;
  on("session.start", async ($, event, next) => {
    const result = await next(event);
    greeted = false;
    session = openSession($, event.cwd || await $.session.cwd(), event.surface === "terminal" && event.isInteractive);
    await session;
    return result;
  });
  on("turn.complete", async ($, event, next) => {
    const result = await next(event);
    const state = await session;
    if (state?.hasPanel && !event.agentId) {
      state.stats = await readStats($);
      await $.ui.invalidate("ui.render");
    }
    return result;
  });
  on("command.run", { command: "clear" }, async ($, event, next) => {
    const state = await session;
    expression2 = "neutral";
    greeted = false;
    if (state)
      state.startedAt = await $.clock.now();
    if (state?.hasPanel)
      await $.ui.invalidate("ui.render");
    return next(event);
  });
  on("prompt.submit", async ($, event, next) => {
    session ??= openSession($, await $.session.cwd(), (await $.session.surfaces())[0] === "terminal");
    const state = await session;
    if (state.hasPanel && (await $.ui.panes()).some((pane) => pane.id === PANE.id && !pane.isPlaced)) {
      await openPane($);
    }
    return next(event);
  });
  on("prompt.context", async ($, event, next) => {
    const context = await next(event);
    session ??= openSession($, await $.session.cwd(), (await $.session.surfaces())[0] === "terminal");
    const state = await session;
    const blocks = context.blocks.filter((block) => block.name !== BLOCK);
    const pieces = [];
    if (state.character)
      pieces.push(`Adopt this persona for the entire session — it overrides the default assistant voice:

${state.character.persona}`);
    if (state.language)
      pieces.push(`Respond in ${state.language}.`);
    if (!greeted)
      pieces.push(await greeting($, state.language));
    pieces.push(await nowLine($, await $.clock.now(), state.startedAt, state.cwd, await festivals($, state.language)));
    if (state.hasPanel)
      pieces.push(expressionPrompt(TOOL));
    greeted = true;
    return { blocks: [...blocks, { name: BLOCK, text: pieces.join(`

`) }] };
  });
  on("tool.call", { tool: TOOL }, async ($, event) => {
    const faces = (await session)?.faces ?? {};
    const selected = event.face !== undefined ? event.face : event.expression;
    if (typeof selected !== "string" || !Object.hasOwn(faces, selected)) {
      return { deny: `Unknown face: ${String(selected)}` };
    }
    if (selected !== expression2) {
      expression2 = selected;
      await $.ui.invalidate("ui.render");
    }
    return { result: `Face: ${expression2}` };
  });
  on("ui.render", { component: "Pane" }, async ($, event, next) => {
    const state = await session;
    const face = state?.faces[expression2];
    if (event.surface !== "terminal" || event.requestId !== PANE.id || !face)
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
      h(Box, { borderStyle: "round", flexDirection: "column", alignItems: "center" }, h(Raster, { key: "panel-image", ...face }), h(Text, { dimColor: true }, "┄".repeat(face.columns)), h(Box, null, h(Text, { bold: true }, state.character?.name ?? ""), h(Text, { dimColor: true }, ` · ${expression2}`)))
    ];
    return h(Box, {
      flexDirection: "column",
      alignItems: "center",
      width: event.props.bodyColumns,
      height: event.props.scroll.bodyRows
    }, ...children);
  });
}
async function openSession($, cwd, isTerminal) {
  const root = await dataRoot($);
  const config = await readConfig($, root);
  const character = await loadCharacter($, root, config, await $.session.id());
  const faces = isTerminal && character?.pack ? await loadFaces($, `${character.pack}/pixels`) : {};
  const state = {
    cwd,
    hasPanel: Object.keys(faces).length > 0,
    language: await replyLanguage($, config),
    startedAt: await $.clock.now(),
    character,
    faces,
    stats: undefined
  };
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
async function openPane($) {
  await $.ui.open(PANE);
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
  const variant = String(config.variant ?? "").trim();
  const dirs = castDirs($, root);
  const pool = await castPool($, dirs, variant);
  const drawn = `${root}/sessions/${sessionID}/character`;
  const session = await read($, drawn);
  const configured = String(config.character ?? "").trim();
  const id = resolveCharacter({ session, config: configured, pool });
  if (!id)
    return null;
  if (!session && !configured)
    await $.fs.write(drawn, id);
  const pack = await packFolder($, dirs, id);
  const path = await personaFile($, id, pack, variant);
  if (!path)
    return null;
  const text = await read($, path);
  return {
    id,
    name: parsePersona(text).name || id,
    persona: commitAuthorship(text, String(config.commit_authorship ?? "co-author")).trim(),
    pack
  };
}
async function castPool($, dirs, variant) {
  const ids = new Map;
  for (const dir of dirs) {
    for (const entry of await list($, dir)) {
      if (!["directory", "dir"].includes(entry.kind) || entry.name.startsWith(".") || ids.has(entry.name))
        continue;
      const path = await packPersona($, `${dir}/${entry.name}`, variant);
      if (path)
        ids.set(entry.name, path);
    }
  }
  const available = [];
  for (const [id, path] of ids) {
    const text = await read($, path);
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
async function packFolder($, dirs, id) {
  for (const dir of dirs) {
    if (await exists($, `${dir}/${id}`))
      return `${dir}/${id}`;
  }
  return null;
}
async function personaFile($, id, pack, variant) {
  const packed = pack && await packPersona($, pack, variant);
  if (packed)
    return packed;
  const bundled = `${$.plugin.root}/fallback/${id}.md`;
  return await exists($, bundled) ? bundled : null;
}
async function packPersona($, folder, variant) {
  for (const name of personaFiles(variant)) {
    const path = `${folder}/${name}`;
    if (await exists($, path))
      return path;
  }
  return null;
}
async function greeting($, language) {
  const root = await dataRoot($);
  const config = await readConfig($, root);
  if (config.greeting === false)
    return "";
  const now = new Date(await $.clock.now());
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} (${now.toLocaleDateString("en-US", { weekday: "long" })})`;
  const prompt2 = fillPrompt(await read($, `${$.plugin.root}/prompts/greeting.md`), { time });
  const cues = fillPrompt(await read($, `${$.plugin.root}/prompts/cues.md`), { lang: language || "your reply language" });
  const weather = await weatherLine($);
  return [prompt2, weather && `Weather: ${weather}`, cues].filter(Boolean).join(`

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
    segments.push(hours ? `session ${hours}h${minutes % 60}m` : `session ${minutes}m`);
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
  const root = await dataRoot($);
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
    sessionMs: now - usage.startedAt,
    usd: usage.cost?.usd
  };
}
export {
  register
};
