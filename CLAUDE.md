# claudecafe

AI 女僕 persona 展示網站。使用者瀏覽角色卡片，按「copy source」複製 persona markdown，貼到自己的 `CLAUDE.md` 讓 Claude 變成對應的可愛女僕。

## Tech Stack

Hono + JSX (SSR), gray-matter, marked, TypeScript

## Key Concepts

- `roles/*.md` 的 frontmatter (id, name, personality, quote) 是網站 metadata；body 是 persona 指令。
- 「copy source」只複製 body，貼到 CLAUDE.md 即可運作。
