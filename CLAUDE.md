# claudecafe (monorepo)

AI 女僕生態系的 pnpm monorepo。repo 根**同時是一個叫 `claudecafe` 的 plugin marketplace**（`.claude-plugin/marketplace.json`，列出 cafe-bell + maid-vibe + maid-persona 三個 plugin）。六個 workspace package，**npm 名都 namespace 在 `@claudecafe/*`**（私有 root 仍叫 `claudecafe-monorepo`）：

- **`apps/web`**（`@claudecafe/web`）— 女僕 persona 展示網站（Hono SSR）。使用者瀏覽角色卡片，按「copy source」複製 persona markdown，貼到自己的 `CLAUDE.md` 讓 Claude 變成對應的可愛女僕。
- **`packages/maids`**（`@claudecafe/maids`，npm package）— 女僕陣容本體（純資料）：6 位 persona 定義 `*.md`（frontmatter = 網站 metadata，body = persona 指令）+ 原始美術稿 png。`apps/web` 以 `workspace:*` 依賴它；`maid-persona` plugin 透過 `require.resolve('@claudecafe/maids/package.json')` 找它（需 link 進 `~/.claude/node_modules/@claudecafe/maids`）。
- **`packages/cafe-bell`** — Claude Code hook 事件的 pub/sub hub（SSE bus）。同時是 marketplace plugin，也以 skills-dir plugin 載入（`~/.claude/skills/cafe-bell` symlink）。
- **`packages/maid-vibe`** — Claude Code plugin：女僕「外顯氣場」層（persona-agnostic）。`session-greeting.sh`（SessionStart）注入時段問候 + 心情標記 cue（要求每則回應結尾加 `【 心情 顏文字 】`，**純風格、不捕捉**）；`current-time.sh`（UserPromptSubmit）每回合注入當下時間（greeting 的時鐘只在開場給一次會過時）；`/look` 描寫外貌。前身是獨立 repo `expressions`。
- **`packages/maid-persona`** — Claude Code plugin：把一位女僕「排班上場」。`load-persona.sh`（SessionStart，**純 bash**）讀 plugin 自帶的 `vendor/<當班>.md` body（strip frontmatter）注入當 session persona + 語言指令。取代舊的 `@cafe/<maid>.md` import。**self-contained**：hook 讀 `${CLAUDE_PLUGIN_ROOT}/vendor`，無 env var／repo 路徑／symlink／**node/bun**（hook 跑在非互動 shell，nvm node、`~/.bun` bun 都不在 PATH）。`vendor/` 是 **build 產物**（gitignore）：`build.ts`（`pnpm --filter @claudecafe/maid-persona build`，dev 端 bun 跑）`require.resolve('@claudecafe/maids')`（devDep）把 cast 複製進來。⚠️ `/plugin install` 不跑 build、只複製檔案（directory source 會帶 untracked），**install 前要先 build**。`CLAUDE_MAID` 換女僕（預設 kurumi）。
- **`packages/maid-voice-player`** — 訂閱 cafe-bell SSE bus 的語音播放器，每個 hook 事件播一段女僕語音（launchd 常駐）。

> **載入方式**：三個 plugin 都從 marketplace **install + enable**（`@claudecafe` directory marketplace = 本 repo）。先前的 loose `~/.claude/hooks/` 鏡像、`skills/cafe-bell` symlink、`~/.claude/node_modules` link 都已拆除；`~/.claude/CLAUDE.md` 砍成純 infra。改 live 全域 config 前要使用者明確授權。
>
> **改 plugin 要 bump 版號才更新得到**：`/plugin update` 比對 version，版號沒變不會重裝。改動後同步 bump 三處（`packages/<p>/.claude-plugin/plugin.json`、根 `marketplace.json` 對應 entry、`package.json`），再 `/plugin marketplace update claudecafe` → `/plugin update <p>@claudecafe`。maid-persona 還要先 `pnpm --filter @claudecafe/maid-persona build` 生 `vendor/`。
>
> **hook 環境沒 JS runtime on PATH**（踩雷）：node 是 nvm、bun 在 `~/.bun`，hook 跑非互動 shell 都不在 PATH → hook 只能純 bash。
>
> mood 心情標記**只 emit 不捕捉**（移除 status line 顯示）：回應結尾的 `【…】` 純風格，已無 `mood-update.sh`/Stop hook/`mood.txt`。

## Workspace

- pnpm workspace（`pnpm-workspace.yaml` → `apps/*`、`packages/*`）。
- **單一 lockfile**：根 `pnpm-lock.yaml` 同時管本地開發與 Docker 部署。web 的 image 是多階段 build（`apps/web/Dockerfile`，context = repo 根）：stage 1 用 node+pnpm `--frozen-lockfile` install 後 `pnpm --filter @claudecafe/web --legacy deploy --prod`（會把 web 的 workspace 依賴 `@claudecafe/maids` 一起打包進 `/out/node_modules/@claudecafe/maids`），stage 2 用 `oven/bun` 跑 deploy bundle。
- 常用：`pnpm install`（根）、`pnpm dev:web`（起站）、`pnpm --filter @claudecafe/web ship`（部署 web，build context 自動指向 repo 根）。
- cafe-bell / maid-vibe / maid-voice-player 無 npm 依賴，直接用 bun / shell 跑。

## apps/web

### Tech Stack

Hono + JSX (SSR), gray-matter, marked, TypeScript

### Key Concepts

- persona 檔的 frontmatter (id, name, personality, quote) 是網站 metadata；body 是 persona 指令。
- 「copy source」只複製 body，貼到 CLAUDE.md 即可運作。
- persona 檔住在 `packages/maids`（npm `@claudecafe/maids`），web 透過 `require.resolve('@claudecafe/maids/package.json')` 取得目錄（dev 走 pnpm symlink、Docker 走 deploy bundle 都通）。

### Content Directories

- `packages/maids/*.md` — 角色定義檔。每個檔案 = 一位女僕，frontmatter 供網站渲染，body 是實際 persona 指令。
- `apps/web/blog/` — 部落格文章 (`*.md`)。frontmatter 含 title / date / author，body 是文章內容，以 marked 渲染成 HTML。
