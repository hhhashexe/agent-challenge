FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache python3 make g++ git

# Disable telemetry
ENV ELIZAOS_TELEMETRY_DISABLED=true
ENV DO_NOT_TRACK=1

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package manifest and install dependencies
COPY package.json ./
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Copy all source files
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV SERVER_PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/health 2>/dev/null || exit 1

CMD ["pnpm", "start"]
