FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN bun install --production --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
COPY cafe ./cafe
ENV NODE_ENV=production
EXPOSE 5050
CMD ["bun", "src/index.tsx"]
