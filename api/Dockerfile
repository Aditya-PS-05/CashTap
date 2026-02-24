FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Disable corepack so it never tries to find pnpm
RUN corepack disable 2>/dev/null || true
ENV COREPACK_ENABLE_STRICT=0

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy prisma and generate client
COPY prisma ./prisma/
RUN node node_modules/prisma/build/index.js generate

# Copy source and build
COPY . .
# Remove any pnpm artifacts that may have leaked in
RUN rm -f pnpm-lock.yaml pnpm-workspace.yaml .npmrc
RUN npm run build

# Production image
FROM node:20-slim AS production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Disable corepack in production too
RUN corepack disable 2>/dev/null || true
ENV COREPACK_ENABLE_STRICT=0

WORKDIR /app

COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma

# Clean package.json — no packageManager field
RUN echo '{"name":"bch-pay-api","type":"module"}' > package.json

ENV NODE_ENV=production
EXPOSE 3456

# Use prisma binary directly — zero dependency on any package manager
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db execute --schema prisma/schema.prisma --file prisma/backfill-emails.sql 2>/dev/null; node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss && node dist/index.js"]
