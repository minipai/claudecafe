# claudecafe (monorepo)

AI 女僕生態系的 pnpm monorepo。repo 根**同時是一個叫 `claudecafe` 的 plugin marketplace**
（`.claude-plugin/marketplace.json`，列出 cafe-bell + cafe 兩個 plugin）。六個 package；有 npm
package.json 的**名字都 namespace 在 `@claudecafe/*`**（私有 root 仍叫 `claudecafe-monorepo`；
`packages/cafe` 純 python、無 package.json、不是 workspace 成員）：

- **`apps/website`** — 女僕 persona 展示網站（Hono SSR）。使用者瀏覽角色卡片，按「copy source」
  複製 persona markdown 貼到自己的 `CLAUDE.md`。
- **`packages/maid-personas`** — 女僕 persona 定義 `*.md`（frontmatter = 網站 metadata，
  body = persona 指令）。`apps/website` 以 `workspace:*` 依賴；`cafe` plugin 的 `build.py`
  在 build 時直接複製進 plugin 的 maids/（monorepo 相對路徑）。
- **`packages/maid-assets`** — web／desktop 共用的角色美術資產。目前收納ことね／ここな的
  表情差分、生成用 seed 圖與共用設計規格；各 app 在 build 時再挑選並複製自己需要的圖片。
- **`packages/cafe-bell`** — Claude Code hook 事件的 pub/sub hub（SSE bus）。同時是 marketplace plugin。
- **`packages/cafe`** — Claude Code plugin（hooks ＋ 唯一的 `/cafe:config` 設定命令；設定住
  `~/.claude/cafe/config.json`：lang／maid／personas_dir／builtin_cast，單人退休用 persona
  frontmatter `off_duty: true`，內建的用同 id stub 蓋掉），兩層功能：
  - **排班**：`load-persona.py`（SessionStart）讀 `maids/<當班>.md` body 注入當 session persona。
    當班順序：`CLAUDE_MAID` env（一次性 override）→ 本視窗的 `~/.claude/cafe/sessions/<session_id>/on-shift`
    → 從內建陣容隨機抽一位（抽完寫回該檔，resume 才不會換人）；值為 `none` = 不注入
    （給自帶 CLAUDE.md persona 的使用者）。
  - **外顯氣場**（persona-agnostic）：`session-greeting.py` 注入時段問候 + 心情標記 cue、
    `current-time.py`（UserPromptSubmit）每回合注入當下時間、Stop hook 背景生成 status line 的
    look 場景、SessionEnd 寫交接簿日記。
- **`packages/maid-voice-player`** — 訂閱 cafe-bell SSE bus 的語音播放器（launchd 常駐）。

## ⚠️ Plugin 開發的四顆雷

- **hook 環境沒 JS runtime on PATH**：node 是 nvm、bun 在 `~/.bun`，hook 跑非互動 shell 都不在
  PATH → **hook 只能用系統自帶的 bash／python3**。`cafe` 的 hook 因此 self-contained：純 python3
  stdlib、只讀 `${CLAUDE_PLUGIN_ROOT}/maids`，無 repo 路徑／symlink／node/bun。
- **`maids/` 是 build 產物**（gitignore）：`build.py` 把 `packages/maid-personas` 的 cast
  複製進來。**`/plugin install` 不跑 build、只複製檔案**（directory source 會帶 untracked），
  所以 install 前要先 `python3 packages/cafe/build.py`。
- **改 plugin 一定要 bump 版號**：`/plugin update` 比對 version，版號沒變不會重裝。改動後同步 bump
  `packages/<p>/.claude-plugin/plugin.json` ＋ 根 `marketplace.json` 對應 entry（有 `package.json`
  的 plugin 也一起），再 `/plugin marketplace update claudecafe` → `/plugin update <p>@claudecafe`。
- **改 live 全域 config（`~/.claude/`）前要使用者明確授權。** 兩個 plugin 都從 marketplace
  install + enable，沒有 loose hook 鏡像或 symlink——不要再手動鋪那些。

mood 心情標記**只 emit 不捕捉**：回應結尾的 `【…】` 純風格，沒有 Stop hook 或 status line 讀它。

## Workspace

- pnpm workspace（`pnpm-workspace.yaml` → `apps/*`、`packages/*`）。
- **單一 lockfile**：根 `pnpm-lock.yaml` 同時管本地開發與 Docker 部署。web 的 image 是多階段 build
  （`apps/website/Dockerfile`，**context = repo 根**）：stage 1 用 node+pnpm `--frozen-lockfile` install 後
  `pnpm --filter @claudecafe/website --legacy deploy --prod`（會把 `@claudecafe/maid-personas` 一起打包進
  `/out/node_modules/`），stage 2 用 `oven/bun` 跑 deploy bundle。
- 常用：`pnpm install`（根）、`pnpm dev:web`、`pnpm --filter @claudecafe/website ship`（部署網站）。
- cafe-bell / maid-voice-player 無 npm 依賴，直接用 bun / shell 跑；cafe 純 python（build 也是）。

## apps/website

Hono + JSX (SSR)、gray-matter、marked、TypeScript。

- persona 檔住在 `packages/maid-personas`，web 透過 `require.resolve('@claudecafe/maid-personas/package.json')`
  取得目錄（dev 走 pnpm symlink、Docker 走 deploy bundle 都通）。
- 「copy source」只複製 body（不含 frontmatter），貼到 CLAUDE.md 即可運作。
- `apps/website/blog/` 是部落格文章（frontmatter 含 title / date / author），寫作風格見該目錄的 `CLAUDE.md`。
