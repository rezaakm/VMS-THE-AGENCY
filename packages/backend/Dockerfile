FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Build stage
FROM base AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./

# Copy prisma files (needed for migrations at startup)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
