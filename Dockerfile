FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json ./
RUN bun install --production
COPY tsconfig.json ./
COPY src ./src
COPY roles ./roles
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "src/index.tsx"]
