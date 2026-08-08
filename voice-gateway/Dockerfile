# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Keep the package manager compatible with Node 20 and reproducible across deploys.
ARG PNPM_VERSION=10.0.0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy manifests first for better layer caching
COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/

# Build
RUN pnpm build

# ── Production stage ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Use the same pinned package manager as the build stage.
ARG PNPM_VERSION=10.0.0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy manifests
COPY package.json pnpm-lock.yaml* ./

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/healthz || exit 1

CMD ["node", "dist/index.js"]
