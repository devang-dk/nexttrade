# =====================================================================
# NexTrade React Client — Dockerfile
# Multi-stage: build with Node → serve with lightweight static server
# =====================================================================

# ── Stage 1: Build ────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (layer cache optimisation)
COPY package*.json ./

# Install ALL deps (legacy flag handles react-scripts peer dep conflicts)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the production React bundle
# REACT_APP_API_URL is injected at build time via docker-compose / build args
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────
FROM node:18-alpine AS runner

# Add a non-root user for security
RUN addgroup -S nextrade && adduser -S nextrade -G nextrade

WORKDIR /app

# Install `serve` globally
RUN npm install -g serve

# Copy built assets from builder
COPY --from=builder --chown=nextrade:nextrade /app/build ./build

USER nextrade

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["serve", "-s", "build", "-l", "3000"]
