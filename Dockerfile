FROM node:24-alpine AS base

RUN apk add --no-cache libc6-compat

RUN corepack enable

FROM base AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN pnpm build

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist

COPY --from=deps /app/node_modules ./node_modules

COPY package.json ./

EXPOSE 3001

CMD ["node", "dist/main.js"]
