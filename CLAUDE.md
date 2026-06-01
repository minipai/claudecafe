# claudecafe (monorepo)

AI 女僕生態系的 pnpm monorepo。三個 workspace package：

- **`apps/web`** — 女僕 persona 展示網站（Hono SSR）。使用者瀏覽角色卡片，按「copy source」複製 persona markdown，貼到自己的 `CLAUDE.md` 讓 Claude 變成對應的可愛女僕。
- **`packages/cafe-bell`** — Claude Code hook 事件的 pub/sub hub（SSE bus）。以 skills-dir plugin 載入（`~/.claude/skills/cafe-bell` symlink）。
- **`packages/maid-voice-player`** — 訂閱 cafe-bell SSE bus 的語音播放器，每個 hook 事件播一段女僕語音（launchd 常駐）。

## Workspace

- pnpm workspace（`pnpm-workspace.yaml` → `apps/*`、`packages/*`）。
- **單一 lockfile**：根 `pnpm-lock.yaml` 同時管本地開發與 Docker 部署。web 的 image 是多階段 build（`apps/web/Dockerfile`，context = repo 根）：stage 1 用 node+pnpm `--frozen-lockfile` install 後 `pnpm --filter claudecafe --legacy deploy --prod`，stage 2 用 `oven/bun` 跑 deploy bundle。
- 常用：`pnpm install`（根）、`pnpm dev:web`（起站）、`pnpm --filter claudecafe ship`（部署 web，build context 自動指向 repo 根）。
- cafe-bell / maid-voice-player 無 npm 依賴，直接用 bun 跑。

## apps/web

### Tech Stack

Hono + JSX (SSR), gray-matter, marked, TypeScript

### Key Concepts

- `cafe/*.md` 的 frontmatter (id, name, personality, quote) 是網站 metadata；body 是 persona 指令。
- 「copy source」只複製 body，貼到 CLAUDE.md 即可運作。

### Content Directories

- `apps/web/cafe/` — 角色定義檔 (`*.md`)。每個檔案 = 一位女僕，frontmatter 供網站渲染，body 是實際 persona 指令。
- `apps/web/blog/` — 部落格文章 (`*.md`)。frontmatter 含 title / date / author，body 是文章內容，以 marked 渲染成 HTML。
