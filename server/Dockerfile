# ─── ChartDB API (Node.js) ────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /usr/src/app/dist ./dist

ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/server.js"]
