# Multi-stage build for the Next.js frontend.

FROM node:22-slim AS base
# Prisma's query engine needs OpenSSL, which the slim image leaves out.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate
RUN npm run build

# One-shot migration runner (docker-compose's `migrate` service): the
# runner image below ships without the Prisma CLI.
# Also seeds structure (communities, moderation rules, gear catalog); the seed is idempotent.
FROM builder AS migrate
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

# Background worker (docker-compose's `worker` service): runs TypeScript
# directly with tsx from the builder's full node_modules.
FROM builder AS worker
ENV NODE_ENV=production
# ffmpeg/ffprobe do all media probing and transcoding (lib/media/ffmpeg.ts).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
# Same uid as the runner: both write to the shared song volume.
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs \
    && mkdir -p /data/songs && chown nextjs:nodejs /data/songs
USER nextjs
CMD ["npx", "tsx", "worker/index.ts"]

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# Local song storage (used when Supabase isn't configured); mount a volume here.
RUN mkdir -p /data/songs && chown nextjs:nodejs /data/songs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
