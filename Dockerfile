FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN bun install --production --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
COPY cafe ./cafe
COPY blog ./blog

ENV NODE_ENV=production
EXPOSE 5050
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:5050/robots.txt || exit 1
CMD ["bun", "src/index.tsx"]
