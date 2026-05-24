# --- STAGE 1: Base Environment & Dependencies ---
FROM node:24-alpine AS base
RUN apk update && apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./

# Cached unless package.json/package-lock.json changes
RUN npm ci

# --- STAGE 2: Builder (TypeScript Compilation) ---
FROM base AS builder

COPY . .

RUN npm run build

# --- STAGE 3: Production Runtime ---
FROM node:24-alpine AS production
RUN apk update && apk add --no-cache su-exec
WORKDIR /app

# Copy compiled output and migration files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/knexfile.ts ./knexfile.ts
COPY --from=builder /app/database ./database
COPY package*.json ./

# Only production dependencies
RUN npm ci --only=production

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/logs && \
    chown -R node:node /app/logs && \
    chmod -R 755 /app/logs

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/src/server.js"]
