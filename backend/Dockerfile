FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl curl git
RUN corepack enable && corepack prepare pnpm@9 --activate

# deps stage - production dependencies only
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --prod --frozen-lockfile
# Install prisma CLI temporarily just for generating the client
RUN pnpm add -D prisma@5.22.0
RUN pnpm exec prisma generate

# build stage - all dependencies for building
FROM base AS builder
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate
COPY . .
RUN pnpm run build

# production stage - minimal runtime image
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/prisma ./prisma
COPY package.json ./
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1
CMD ["node", "dist/main"]
