# claudecafe (monorepo)

AI 女僕生態系的 pnpm monorepo。repo 根**同時是一個叫 `claudecafe` 的 plugin marketplace**（`.claude-plugin/marketplace.json`，列出 cafe-bell + maid-vibe 兩個 plugin）。五個 workspace package：

- **`apps/web`** — 女僕 persona 展示網站（Hono SSR）。使用者瀏覽角色卡片，按「copy source」複製 persona markdown，貼到自己的 `CLAUDE.md` 讓 Claude 變成對應的可愛女僕。
- **`packages/maids`** — 女僕陣容本體：6 位 persona 定義 `*.md`（frontmatter = 網站 metadata，body = persona 指令）+ 原始美術稿 png。`apps/web` 以 `workspace:*` 依賴它取得 persona 檔。
- **`packages/cafe-bell`** — Claude Code hook 事件的 pub/sub hub（SSE bus）。同時是 marketplace plugin，也以 skills-dir plugin 載入（`~/.claude/skills/cafe-bell` symlink）。
- **`packages/maid-vibe`** — Claude Code plugin（marketplace 第二個 plugin）：女僕「外顯氣場」層 — 時段問候（SessionStart hook）、心情標記捕捉（Stop hook）、`/look` 描寫外貌。persona-agnostic。前身是獨立 repo `expressions`。
- **`packages/maid-voice-player`** — 訂閱 cafe-bell SSE bus 的語音播放器，每個 hook 事件播一段女僕語音（launchd 常駐）。

> 注意：maid-vibe 目前**只是 marketplace 裡可安裝的 plugin（休眠）**；實際在跑的問候/心情 hook 是 loose 在 `~/.claude/hooks/` 並寫死在 `~/.claude/settings.json` 的同名腳本。別在 symlink 已載入 cafe-bell 的情況下又 `/plugin install cafe-bell`，會雙載。

## Workspace

- pnpm workspace（`pnpm-workspace.yaml` → `apps/*`、`packages/*`）。
- **單一 lockfile**：根 `pnpm-lock.yaml` 同時管本地開發與 Docker 部署。web 的 image 是多階段 build（`apps/web/Dockerfile`，context = repo 根）：stage 1 用 node+pnpm `--frozen-lockfile` install 後 `pnpm --filter claudecafe --legacy deploy --prod`（會把 web 的 workspace 依賴 `maids` 一起打包進 `/out/node_modules/maids`），stage 2 用 `oven/bun` 跑 deploy bundle。
- 常用：`pnpm install`（根）、`pnpm dev:web`（起站）、`pnpm --filter claudecafe ship`（部署 web，build context 自動指向 repo 根）。
- cafe-bell / maid-vibe / maid-voice-player 無 npm 依賴，直接用 bun / shell 跑。

## apps/web

### Tech Stack

Hono + JSX (SSR), gray-matter, marked, TypeScript

### Key Concepts

- persona 檔的 frontmatter (id, name, personality, quote) 是網站 metadata；body 是 persona 指令。
- 「copy source」只複製 body，貼到 CLAUDE.md 即可運作。
- persona 檔住在 `packages/maids`，web 透過 `require.resolve('maids/package.json')` 取得目錄（dev 走 pnpm symlink、Docker 走 deploy bundle 都通）。

### Content Directories

- `packages/maids/*.md` — 角色定義檔。每個檔案 = 一位女僕，frontmatter 供網站渲染，body 是實際 persona 指令。
- `apps/web/blog/` — 部落格文章 (`*.md`)。frontmatter 含 title / date / author，body 是文章內容，以 marked 渲染成 HTML。
