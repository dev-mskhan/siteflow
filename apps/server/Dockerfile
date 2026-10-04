# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS builder
WORKDIR /app

# Copy manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
COPY packages/observability/package.json ./packages/observability/
COPY packages/database/package.json ./packages/database/
COPY packages/env/package.json ./packages/env/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build all packages (turbo respects dependency order)
RUN pnpm turbo run build --filter=@siteflow/server...

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy only the built output + production node_modules
COPY --from=builder --chown=appuser:nodejs /app/apps/server/dist ./apps/server/dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder --chown=appuser:nodejs /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder --chown=appuser:nodejs /app/packages/database/dist ./packages/database/dist
COPY --from=builder --chown=appuser:nodejs /app/packages/env/package.json ./packages/env/package.json
COPY --from=builder --chown=appuser:nodejs /app/packages/env/dist ./packages/env/dist
COPY --from=builder --chown=appuser:nodejs /app/packages/observability/package.json ./packages/observability/package.json
COPY --from=builder --chown=appuser:nodejs /app/packages/observability/dist ./packages/observability/dist
COPY --from=builder --chown=appuser:nodejs /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=appuser:nodejs /app/packages/shared/dist ./packages/shared/dist

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:3000/health || exit 1

CMD ["node", "apps/server/dist/index.js"]
