# =====================================================================
# NexTrade Backend — Dockerfile
# Node.js/Express API + Socket.io + MongoDB connection
# =====================================================================

# ── Stage 1: Dependencies ─────────────────────────────────────────────
FROM node:18-alpine AS deps

WORKDIR /app

# Copy dependency manifests first (better layer caching)
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# ── Stage 2: Production image ─────────────────────────────────────────
FROM node:18-alpine AS runner

# Add a non-root user for security
RUN addgroup -S nextrade && adduser -S nextrade -G nextrade

WORKDIR /app

# Copy installed prod dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY --chown=nextrade:nextrade . .

# Drop privileges
USER nextrade

# Expose the API port (matches PORT env var default)
EXPOSE 10000

# Healthcheck — hits the /health endpoint every 30 s
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:10000/health || exit 1

# Start the server
CMD ["node", "server.js"]
