# Multi-stage build. Build context is the MONOREPO ROOT (not apps/web) so the
# image installs from the single source of truth — the root pnpm-lock.yaml —
# and there is no second (npm/bun) lockfile to drift out of sync.
#
#   stage 1 (node + pnpm): frozen install, then `pnpm deploy` a self-contained
#                          prod bundle (app files + flattened node_modules).
#   stage 2 (bun):         run the TS/JSX app directly against that bundle.

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

# Manifests first so the install layer caches until deps actually change.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/cafe-bell/package.json packages/cafe-bell/
COPY packages/maid-voice-player/package.json packages/maid-voice-player/
COPY packages/maid-vibe/package.json packages/maid-vibe/
COPY packages/maids/package.json packages/maids/
RUN pnpm install --frozen-lockfile

# Source, then prune to a self-contained prod bundle for the web app only.
# --legacy: pnpm v10 needs it to deploy non-injected workspace packages.
COPY . .
RUN pnpm --filter @claudecafe/web --legacy deploy --prod /out

FROM oven/bun:1-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out .

EXPOSE 5050
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:5050/robots.txt || exit 1
CMD ["bun", "src/index.tsx"]
